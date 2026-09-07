import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';

const allowedInternalDependencies = new Map([
  ['@pcpartcheck/core', []],
  ['@pcpartcheck/evidence', ['@pcpartcheck/core']],
  ['@pcpartcheck/unit-normalization', ['@pcpartcheck/core']],
  ['@pcpartcheck/rules-standard', ['@pcpartcheck/core']],
  ['@pcpartcheck/power', ['@pcpartcheck/core']],
  ['@pcpartcheck/identity', ['@pcpartcheck/core', '@pcpartcheck/evidence']],
  [
    '@pcpartcheck/similarity',
    ['@pcpartcheck/core', '@pcpartcheck/evidence', '@pcpartcheck/identity'],
  ],
  [
    '@pcpartcheck/provider-sdk',
    ['@pcpartcheck/core', '@pcpartcheck/evidence', '@pcpartcheck/identity'],
  ],
  [
    '@pcpartcheck/provider-buildcores',
    [
      '@pcpartcheck/core',
      '@pcpartcheck/identity',
      '@pcpartcheck/provider-sdk',
      '@pcpartcheck/unit-normalization',
    ],
  ],
  [
    '@pcpartcheck/storage-sqlite',
    [
      '@pcpartcheck/core',
      '@pcpartcheck/evidence',
      '@pcpartcheck/identity',
      '@pcpartcheck/similarity',
    ],
  ],
  [
    '@pcpartcheck/llm-toolkit',
    [
      '@pcpartcheck/core',
      '@pcpartcheck/evidence',
      '@pcpartcheck/identity',
      '@pcpartcheck/similarity',
    ],
  ],
  [
    '@pcpartcheck/api-contracts',
    [
      '@pcpartcheck/core',
      '@pcpartcheck/evidence',
      '@pcpartcheck/identity',
      '@pcpartcheck/similarity',
    ],
  ],
  [
    '@pcpartcheck/demo-data',
    [
      '@pcpartcheck/core',
      '@pcpartcheck/evidence',
      '@pcpartcheck/identity',
      '@pcpartcheck/provider-sdk',
    ],
  ],
  ['@pcpartcheck/http-server', ['@pcpartcheck/api-contracts']],
  ['@pcpartcheck/demo-web', ['@pcpartcheck/api-contracts']],
]);

function readRootArgument(arguments_) {
  const index = arguments_.indexOf('--root');
  return index === -1 ? process.cwd() : resolve(arguments_[index + 1]);
}

async function readWorkspacePackages(root) {
  const manifests = [];

  for (const parent of ['packages', 'apps']) {
    const directory = join(root, parent);
    let entries;

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(directory, entry.name, 'package.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifests.push(manifest);
    }
  }

  return manifests;
}

function internalDependencies(manifest) {
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ].filter((dependency) => dependency.startsWith('@pcpartcheck/'));
}

async function main() {
  const manifests = await readWorkspacePackages(readRootArgument(process.argv.slice(2)));
  const violations = manifests.flatMap((manifest) => {
    const allowed = new Set(allowedInternalDependencies.get(manifest.name) ?? []);
    return internalDependencies(manifest)
      .filter((dependency) => !allowed.has(dependency))
      .map((dependency) => `${manifest.name} -> ${dependency} is not allowed`);
  });

  if (violations.length > 0) {
    process.stderr.write(`${violations.join('\n')}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('check-dependency-graph.mjs')) {
  await main();
}
