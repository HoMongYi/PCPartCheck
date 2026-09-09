import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const requiredFiles = [
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'LICENSE',
  'ATTRIBUTION.md',
  'docs/ARCHITECTURE.md',
  'docs/RULE-ENGINE.md',
  'docs/EVIDENCE-MODEL.md',
  'docs/IDENTITY-MAPPING.md',
  'docs/POWER-BUDGET.md',
  'docs/PROVIDER-SDK.md',
  'docs/API.md',
  'docs/ADDING-A-RULE.md',
  'docs/ADDING-A-PROVIDER.md',
  'docs/FIELD-EVIDENCE.md',
  'docs/LLM-INTEGRATION.md',
  'docs/OPERATIONS.md',
  'docs/ROADMAP.md',
  'docs/HANDOFF.md',
  'docs/openapi.json',
  'docs/diagrams/package-dependencies.mmd',
  'docs/diagrams/runtime-data-flow.mmd',
  'docs/assets/package-dependencies.svg',
  'docs/assets/runtime-data-flow.svg',
  'docs/assets/demo-overview.png',
];

const markdownLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/gu;
const endpointPattern = /`(GET|POST|PUT|PATCH|DELETE) ([^`]+)`/gu;

function readRootArgument(arguments_) {
  const index = arguments_.indexOf('--root');
  return index === -1 ? process.cwd() : resolve(arguments_[index + 1]);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function collectMarkdownFiles(root) {
  const files = [];
  for (const candidate of ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'ATTRIBUTION.md']) {
    if (await exists(join(root, candidate))) files.push(join(root, candidate));
  }

  async function visit(directory) {
    if (!(await exists(directory))) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path);
    }
  }

  await visit(join(root, 'docs'));
  return files;
}

function normalizeMarkdownTarget(rawTarget) {
  const withoutTitle = rawTarget.trim().replace(/^<|>$/gu, '').split(/\s+["']/u, 1)[0];
  return decodeURIComponent(withoutTitle.split('#', 1)[0]);
}

async function validateMarkdownLinks(root, errors) {
  for (const file of await collectMarkdownFiles(root)) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(markdownLinkPattern)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|data:|codex:)/iu.test(target) || target.startsWith('#')) continue;
      const normalized = normalizeMarkdownTarget(target);
      if (!normalized) continue;
      const targetPath = resolve(dirname(file), normalized);
      const relativeTarget = relative(root, targetPath);
      if (relativeTarget.startsWith(`..${sep}`) || relativeTarget === '..') {
        errors.push(`Internal Markdown link leaves repository: ${relative(root, file)} -> ${target}`);
      } else if (!(await exists(targetPath))) {
        errors.push(`Broken internal Markdown link: ${relative(root, file)} -> ${target}`);
      }
    }
  }
}

async function readWorkspaceManifests(root) {
  const manifests = [];
  for (const parent of ['packages', 'apps']) {
    const directory = join(root, parent);
    if (!(await exists(directory))) continue;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(directory, entry.name, 'package.json');
      if (await exists(manifestPath)) {
        manifests.push(JSON.parse(await readFile(manifestPath, 'utf8')));
      }
    }
  }
  return manifests;
}

function getInternalDependencies(manifest) {
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .flatMap((field) => Object.keys(manifest[field] ?? {}))
    .filter((dependency) => dependency.startsWith('@pcpartcheck/'));
}

async function validatePackageDiagram(root, errors) {
  const diagramPath = join(root, 'docs', 'diagrams', 'package-dependencies.mmd');
  if (!(await exists(diagramPath))) return;

  const source = await readFile(diagramPath, 'utf8');
  const nodeLabels = new Map(
    [...source.matchAll(/^\s*([A-Za-z0-9_]+)\["(@pcpartcheck\/[^"]+)"\]/gmu)]
      .map((match) => [match[1], match[2]]),
  );
  const documentedEdges = new Set(
    [...source.matchAll(/^\s*([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)\s*$/gmu)]
      .map((match) => `${nodeLabels.get(match[1])} --> ${nodeLabels.get(match[2])}`)
      .filter((edge) => !edge.includes('undefined')),
  );
  const expectedEdges = new Set(
    (await readWorkspaceManifests(root)).flatMap((manifest) =>
      getInternalDependencies(manifest).map(
        (dependency) => `${manifest.name} --> ${dependency}`,
      ),
    ),
  );

  for (const edge of expectedEdges) {
    if (!documentedEdges.has(edge)) {
      errors.push(`Package diagram is missing dependency edge: ${edge}`);
    }
  }
  for (const edge of documentedEdges) {
    if (!expectedEdges.has(edge)) {
      errors.push(`Package diagram has an undeclared dependency edge: ${edge}`);
    }
  }
}

function documentedEndpoints(markdown) {
  return new Set(
    [...markdown.matchAll(endpointPattern)].map((match) => `${match[1]} ${match[2]}`),
  );
}

const documentationTransportEndpoints = new Set([
  'GET /docs/',
  'GET /openapi.json',
]);

function openApiEndpoints(document) {
  const endpoints = new Set();
  for (const [path, operations] of Object.entries(document.paths ?? {})) {
    for (const method of Object.keys(operations)) {
      const normalized = method.toUpperCase();
      if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalized)) {
        endpoints.add(`${normalized} ${path}`);
      }
    }
  }
  return endpoints;
}

async function validateOpenApiDocumentation(root, errors) {
  const openApiPath = join(root, 'docs', 'openapi.json');
  const apiDocumentPath = join(root, 'docs', 'API.md');
  if (!(await exists(openApiPath)) || !(await exists(apiDocumentPath))) return;

  let openApi;
  try {
    openApi = JSON.parse(await readFile(openApiPath, 'utf8'));
  } catch (error) {
    errors.push(`Generated OpenAPI is not valid JSON: ${error.message}`);
    return;
  }
  if (typeof openApi.openapi !== 'string' || typeof openApi.paths !== 'object') {
    errors.push('Generated OpenAPI is missing openapi or paths');
    return;
  }

  const runtimeEndpoints = openApiEndpoints(openApi);
  const apiEndpoints = documentedEndpoints(await readFile(apiDocumentPath, 'utf8'));
  for (const endpoint of runtimeEndpoints) {
    if (!apiEndpoints.has(endpoint)) {
      errors.push(`API documentation is missing generated endpoint: ${endpoint}`);
    }
  }
  for (const endpoint of apiEndpoints) {
    if (!runtimeEndpoints.has(endpoint) && !documentationTransportEndpoints.has(endpoint)) {
      errors.push(`API documentation contains an unknown endpoint: ${endpoint}`);
    }
  }

  const readmePath = join(root, 'README.md');
  if (await exists(readmePath)) {
    for (const endpoint of documentedEndpoints(await readFile(readmePath, 'utf8'))) {
      if (!runtimeEndpoints.has(endpoint) && !documentationTransportEndpoints.has(endpoint)) {
        errors.push(`README contains an unknown endpoint: ${endpoint}`);
      }
    }
  }
}

async function main() {
  const root = readRootArgument(process.argv.slice(2));
  const errors = [];

  for (const file of requiredFiles) {
    if (!(await exists(join(root, file)))) errors.push(`Required documentation file is missing: ${file}`);
  }

  await validateMarkdownLinks(root, errors);
  await validatePackageDiagram(root, errors);
  await validateOpenApiDocumentation(root, errors);

  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Documentation links, assets, dependency graph, and OpenAPI endpoints are consistent.\n');
}

await main();
