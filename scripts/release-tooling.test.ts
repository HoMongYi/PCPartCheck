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

function runScript(script: string, root: string, ...arguments_: string[]) {
  return spawnSync(
    process.execPath,
    [resolve('scripts', script), '--root', root, ...arguments_],
    { encoding: 'utf8' },
  );
}

test('version check rejects a public package version that drifts from 0.1.0', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pcpartcheck-versions-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'packages', 'core', 'src'), { recursive: true });
  await writeFile(
    join(root, 'packages', 'core', 'package.json'),
    JSON.stringify({ name: '@pcpartcheck/core', version: '0.2.0' }),
  );
  await writeFile(join(root, 'packages', 'core', 'src', 'index.ts'), '');

  const result = runScript('check-versions.mjs', root, '--source-only');

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    '@pcpartcheck/core package version must be 0.1.0, received 0.2.0',
  );
});

test('version check rejects a missing runtime version constant', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pcpartcheck-version-source-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'packages', 'core', 'src'), { recursive: true });
  await writeFile(
    join(root, 'packages', 'core', 'package.json'),
    JSON.stringify({ name: '@pcpartcheck/core', version: '0.1.0' }),
  );
  await writeFile(join(root, 'packages', 'core', 'src', 'index.ts'), '');

  const result = runScript('check-versions.mjs', root, '--source-only');

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'ENGINE_VERSION source constant is missing',
  );
});
