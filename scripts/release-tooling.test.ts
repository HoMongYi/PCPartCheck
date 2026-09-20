import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

test('version check rejects a direct-contract package below 0.2.0', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pcpartcheck-versions-'));
  temporaryDirectories.push(root);
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'pcpartcheck', private: true, version: '0.2.0' }),
  );
  await mkdir(join(root, 'packages', 'core', 'src'), { recursive: true });
  await writeFile(
    join(root, 'packages', 'core', 'package.json'),
    JSON.stringify({ name: '@pcpartcheck/core', version: '0.1.0' }),
  );
  await writeFile(join(root, 'packages', 'core', 'src', 'index.ts'), '');

  const result = runScript('check-versions.mjs', root, '--source-only');

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    '@pcpartcheck/core package version must be 0.2.0, received 0.1.0',
  );
});

test('version check rejects a dependency-only package above 0.1.1', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pcpartcheck-dependency-versions-'));
  temporaryDirectories.push(root);
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'pcpartcheck', private: true, version: '0.2.0' }),
  );
  await mkdir(join(root, 'packages', 'power'), { recursive: true });
  await writeFile(
    join(root, 'packages', 'power', 'package.json'),
    JSON.stringify({ name: '@pcpartcheck/power', version: '0.2.0' }),
  );

  const result = runScript('check-versions.mjs', root, '--source-only');

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    '@pcpartcheck/power package version must be 0.1.1, received 0.2.0',
  );
});

test('version check rejects a missing runtime version constant', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pcpartcheck-version-source-'));
  temporaryDirectories.push(root);
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'pcpartcheck', private: true, version: '0.2.0' }),
  );
  await mkdir(join(root, 'packages', 'core', 'src'), { recursive: true });
  await writeFile(
    join(root, 'packages', 'core', 'package.json'),
    JSON.stringify({ name: '@pcpartcheck/core', version: '0.2.0' }),
  );
  await writeFile(join(root, 'packages', 'core', 'src', 'index.ts'), '');

  const result = runScript('check-versions.mjs', root, '--source-only');

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'ENGINE_VERSION source constant is missing',
  );
});

test('release metadata describes the unpublished v0.2 contract map', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pcpartcheck-release-metadata-'));
  temporaryDirectories.push(root);
  const outputPath = join(root, 'release-metadata.json');
  const result = spawnSync(
    process.execPath,
    [resolve('scripts/create-release-metadata.mjs'), outputPath],
    { encoding: 'utf8' },
  );

  expect(result.status, result.stderr).toBe(0);
  const metadata = JSON.parse(await readFile(outputPath, 'utf8')) as {
    readonly releaseCandidate: string;
    readonly npmPublishEnabled: boolean;
    readonly versionDomains: Readonly<Record<string, string>>;
  };
  expect(metadata).toMatchObject({
    releaseCandidate: 'v0.2.0',
    npmPublishEnabled: false,
    versionDomains: {
      engine: '0.2.0',
      canonicalSchema: '3.1.0',
      installationContext: '2.1.0',
      knowledgeSnapshot: '1.0.0',
      fieldEvidence: '4.0.0',
      evidencePolicy: '1.0.0',
      resultSnapshot: '3.0.0',
      ruleSet: '0.2.0',
      identityMapper: '1.1.0',
      buildCoresAdapter: '3.0.0',
      referencePolicy: '2.0.0',
    },
  });
});
