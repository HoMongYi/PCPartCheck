import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, expect, test } from 'vitest';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

async function createDocumentationFixture(options: {
  readonly readme: string;
  readonly packageDiagram: string;
}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcpartcheck-docs-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'docs', 'diagrams'), { recursive: true });
  await mkdir(join(root, 'packages', 'core'), { recursive: true });
  await mkdir(join(root, 'packages', 'evidence'), { recursive: true });
  await writeFile(join(root, 'README.md'), options.readme);
  await writeFile(join(root, 'docs', 'API.md'), '- `GET /health`\n');
  await writeFile(
    join(root, 'docs', 'openapi.json'),
    JSON.stringify({ openapi: '3.1.0', paths: { '/health': { get: {} } } }),
  );
  await writeFile(
    join(root, 'docs', 'diagrams', 'package-dependencies.mmd'),
    options.packageDiagram,
  );
  await writeFile(
    join(root, 'packages', 'core', 'package.json'),
    JSON.stringify({ name: '@pcpartcheck/core', version: '0.1.0' }),
  );
  await writeFile(
    join(root, 'packages', 'evidence', 'package.json'),
    JSON.stringify({
      name: '@pcpartcheck/evidence',
      version: '0.1.0',
      dependencies: { '@pcpartcheck/core': 'workspace:*' },
    }),
  );
  return root;
}

function runDocumentationCheck(root: string) {
  return spawnSync(
    process.execPath,
    [resolve('scripts/check-documentation.mjs'), '--root', root],
    { encoding: 'utf8' },
  );
}

test('reports broken repository-local Markdown links', async () => {
  const root = await createDocumentationFixture({
    readme: '[missing](docs/MISSING.md)\n',
    packageDiagram: [
      'flowchart TD',
      '  core["@pcpartcheck/core"]',
      '  evidence["@pcpartcheck/evidence"]',
      '  evidence --> core',
    ].join('\n'),
  });

  const result = runDocumentationCheck(root);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Broken internal Markdown link');
});

test('compares the Mermaid graph with workspace dependencies', async () => {
  const root = await createDocumentationFixture({
    readme: '# Fixture\n',
    packageDiagram: [
      'flowchart TD',
      '  core["@pcpartcheck/core"]',
      '  evidence["@pcpartcheck/evidence"]',
    ].join('\n'),
  });

  const result = runDocumentationCheck(root);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'Package diagram is missing dependency edge: @pcpartcheck/evidence --> @pcpartcheck/core',
  );
});
