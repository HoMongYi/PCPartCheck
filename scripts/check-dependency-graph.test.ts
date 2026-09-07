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

async function createWorkspace(
  packages: ReadonlyArray<{
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly name: string;
  }>,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcpartcheck-deps-'));
  temporaryDirectories.push(root);

  for (const workspacePackage of packages) {
    const directory = join(root, 'packages', workspacePackage.name.split('/').at(-1)!);
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        name: workspacePackage.name,
        dependencies: workspacePackage.dependencies,
      }),
    );
  }

  return root;
}

function runDependencyCheck(root: string) {
  return spawnSync(
    process.execPath,
    [resolve('scripts/check-dependency-graph.mjs'), '--root', root],
    { encoding: 'utf8' },
  );
}

test('accepts dependencies that point toward core', async () => {
  const root = await createWorkspace([
    { name: '@pcpartcheck/core' },
    {
      name: '@pcpartcheck/rules-standard',
      dependencies: { '@pcpartcheck/core': 'workspace:*' },
    },
    {
      name: '@pcpartcheck/power',
      dependencies: { '@pcpartcheck/core': 'workspace:*' },
    },
  ]);

  const result = runDependencyCheck(root);

  expect(result.status, result.stderr).toBe(0);
});

test('rejects every internal dependency declared by core', async () => {
  const root = await createWorkspace([
    {
      name: '@pcpartcheck/core',
      dependencies: { '@pcpartcheck/evidence': 'workspace:*' },
    },
    { name: '@pcpartcheck/evidence' },
  ]);

  const result = runDependencyCheck(root);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    '@pcpartcheck/core -> @pcpartcheck/evidence is not allowed',
  );
});

test('rejects app dependencies that bypass api contracts', async () => {
  const root = await createWorkspace([
    { name: '@pcpartcheck/api-contracts' },
    { name: '@pcpartcheck/http-server' },
    {
      name: '@pcpartcheck/demo-web',
      dependencies: { '@pcpartcheck/http-server': 'workspace:*' },
    },
  ]);

  const result = runDependencyCheck(root);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    '@pcpartcheck/demo-web -> @pcpartcheck/http-server is not allowed',
  );
});
