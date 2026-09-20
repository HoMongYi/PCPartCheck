import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const expected = {
  rootPackage: '0.2.0',
  engine: '0.2.0',
  canonicalSchema: '3.1.0',
  installationContext: '2.1.0',
  knowledgeSnapshot: '1.0.0',
  fieldEvidence: '4.0.0',
  evidencePolicy: '1.0.0',
  snapshot: '3.0.0',
  ruleSet: '0.2.0',
  identityMapper: '1.1.0',
  providerAdapter: '3.0.0',
  referencePolicy: '2.0.0',
};

const expectedPackageVersions = new Map([
  ['@pcpartcheck/api-contracts', '0.2.0'],
  ['@pcpartcheck/core', '0.2.0'],
  ['@pcpartcheck/demo-data', '0.2.0'],
  ['@pcpartcheck/evidence', '0.2.0'],
  ['@pcpartcheck/provider-sdk', '0.2.0'],
  ['@pcpartcheck/rules-standard', '0.2.0'],
  ['@pcpartcheck/similarity', '0.2.0'],
  ['@pcpartcheck/http-server', '0.1.1'],
  ['@pcpartcheck/identity', '0.1.1'],
  ['@pcpartcheck/llm-toolkit', '0.1.1'],
  ['@pcpartcheck/power', '0.1.1'],
  ['@pcpartcheck/provider-buildcores', '0.1.1'],
  ['@pcpartcheck/storage-sqlite', '0.1.1'],
  ['@pcpartcheck/unit-normalization', '0.1.1'],
]);

const sourceContracts = [
  ['packages/core/src/version.ts', 'ENGINE_VERSION', expected.engine],
  ['packages/core/src/canonical/primitives.ts', 'CANONICAL_SCHEMA_VERSION', expected.canonicalSchema],
  ['packages/core/src/installation-context.ts', 'INSTALLATION_CONTEXT_SCHEMA_VERSION', expected.installationContext],
  ['packages/core/src/knowledge.ts', 'KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION', expected.knowledgeSnapshot],
  ['packages/core/src/snapshot.ts', 'SNAPSHOT_FORMAT_VERSION', expected.snapshot],
  ['packages/evidence/src/field-evidence.ts', 'FIELD_EVIDENCE_SCHEMA_VERSION', expected.fieldEvidence],
  ['packages/evidence/src/evidence-policy.ts', 'FIELD_EVIDENCE_POLICY_VERSION', expected.evidencePolicy],
  ['packages/identity/src/identity-mapper.ts', 'IDENTITY_MAPPER_VERSION', expected.identityMapper],
  ['packages/rules-standard/src/version.ts', 'STANDARD_RULE_SET_VERSION', expected.ruleSet],
  ['packages/provider-buildcores/src/types.ts', 'BUILDCORES_MAPPER_VERSION', expected.providerAdapter],
  ['apps/reference-api/src/services.ts', 'REFERENCE_POLICY_VERSION', expected.referencePolicy],
];

function readArgument(arguments_, name, fallback) {
  const index = arguments_.indexOf(name);
  return index === -1 ? fallback : arguments_[index + 1];
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

async function readManifests(root) {
  const manifests = [];
  for (const parent of ['packages', 'apps']) {
    const directory = join(root, parent);
    if (!(await exists(directory))) continue;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(directory, entry.name, 'package.json');
      if (!(await exists(manifestPath))) continue;
      manifests.push({
        path: manifestPath,
        value: JSON.parse(await readFile(manifestPath, 'utf8')),
      });
    }
  }
  return manifests;
}

function compare(label, actual, wanted, errors) {
  if (actual !== wanted) errors.push(`${label} must be ${wanted}, received ${String(actual)}`);
}

async function main() {
  const arguments_ = process.argv.slice(2);
  const root = resolve(readArgument(arguments_, '--root', process.cwd()));
  const sourceOnly = arguments_.includes('--source-only');
  const errors = [];
  const manifests = await readManifests(root);
  const rootManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

  compare('root package version', rootManifest.version, expected.rootPackage, errors);

  for (const { value: manifest } of manifests) {
    if (manifest.private === true) continue;
    const wanted = expectedPackageVersions.get(manifest.name);
    if (wanted === undefined) {
      errors.push(`Unexpected public package in version contract: ${manifest.name}`);
      continue;
    }
    compare(`${manifest.name} package version`, manifest.version, wanted, errors);
  }
  for (const name of expectedPackageVersions.keys()) {
    if (!manifests.some(({ value }) => value.name === name)) {
      errors.push(`Expected public package is missing: ${name}`);
    }
  }

  for (const [relativePath, name, wanted] of sourceContracts) {
    const path = join(root, relativePath);
    if (!(await exists(path))) {
      errors.push(`${name} source constant is missing: ${relativePath}`);
      continue;
    }
    const source = await readFile(path, 'utf8');
    const match = source.match(new RegExp(`export const ${name} = ["']([^"']+)["'] as const`));
    if (!match) {
      errors.push(`${name} source constant is missing: ${relativePath}`);
      continue;
    }
    compare(`${name} source constant`, match[1], wanted, errors);
  }

  if (!sourceOnly) {
    const importBuilt = async (relativePath) => import(pathToFileURL(join(root, relativePath)).href);
    const [core, evidence, identity, rules, provider, referenceApi] = await Promise.all([
      importBuilt('packages/core/dist/index.js'),
      importBuilt('packages/evidence/dist/index.js'),
      importBuilt('packages/identity/dist/index.js'),
      importBuilt('packages/rules-standard/dist/index.js'),
      importBuilt('packages/provider-buildcores/dist/index.js'),
      importBuilt('apps/reference-api/dist/services.js'),
    ]);

    compare('ENGINE_VERSION public export', core.ENGINE_VERSION, expected.engine, errors);
    compare('CANONICAL_SCHEMA_VERSION public export', core.CANONICAL_SCHEMA_VERSION, expected.canonicalSchema, errors);
    compare('INSTALLATION_CONTEXT_SCHEMA_VERSION public export', core.INSTALLATION_CONTEXT_SCHEMA_VERSION, expected.installationContext, errors);
    compare('KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION public export', core.KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION, expected.knowledgeSnapshot, errors);
    compare('SNAPSHOT_FORMAT_VERSION public export', core.SNAPSHOT_FORMAT_VERSION, expected.snapshot, errors);
    compare('FIELD_EVIDENCE_SCHEMA_VERSION public export', evidence.FIELD_EVIDENCE_SCHEMA_VERSION, expected.fieldEvidence, errors);
    compare('FIELD_EVIDENCE_POLICY_VERSION public export', evidence.FIELD_EVIDENCE_POLICY_VERSION, expected.evidencePolicy, errors);
    compare('IDENTITY_MAPPER_VERSION public export', identity.IDENTITY_MAPPER_VERSION, expected.identityMapper, errors);
    compare('STANDARD_RULE_SET_VERSION public export', rules.STANDARD_RULE_SET_VERSION, expected.ruleSet, errors);
    compare('BUILDCORES_MAPPER_VERSION public export', provider.BUILDCORES_MAPPER_VERSION, expected.providerAdapter, errors);

    const services = referenceApi.createReferenceApiServices();
    const demoData = await importBuilt('packages/demo-data/dist/index.js');
    const snapshot = await services.checkCompatibility(demoData.DEMO_SCENARIOS[0].input);
    compare('snapshot engineVersion', snapshot.engineVersion, expected.engine, errors);
    compare('snapshot ruleSetVersion', snapshot.ruleSetVersion, expected.ruleSet, errors);
    compare('snapshot canonicalSchemaVersion', snapshot.canonicalSchemaVersion, expected.canonicalSchema, errors);
    compare('snapshot installationContextSchemaVersion', snapshot.installationContextSchemaVersion, expected.installationContext, errors);
    compare('snapshot knowledgeSnapshotSchemaVersion', snapshot.knowledgeSnapshotSchemaVersion, expected.knowledgeSnapshot, errors);
    compare('snapshot evidencePolicyVersion', snapshot.evidencePolicyVersion, expected.evidencePolicy, errors);
    compare('snapshot identityMapperVersion', snapshot.identityMapperVersion, expected.identityMapper, errors);
    compare('snapshot snapshotFormatVersion', snapshot.snapshotFormatVersion, expected.snapshot, errors);
    compare('snapshot policyVersion', snapshot.policyVersion, expected.referencePolicy, errors);
    compare('REFERENCE_POLICY_VERSION runtime constant', referenceApi.REFERENCE_POLICY_VERSION, expected.referencePolicy, errors);
  }

  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Package, runtime, public export, and snapshot versions are consistent.\n');
}

await main();
