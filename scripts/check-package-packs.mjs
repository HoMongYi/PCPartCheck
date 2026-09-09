import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packagesDirectory = resolve('packages');
const errors = [];
let packageCount = 0;

for (const entry of await readdir(packagesDirectory, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = join(packagesDirectory, entry.name);
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  if (manifest.private === true) continue;
  packageCount += 1;

  const packageDirectory = relative(root, directory).replaceAll('\\', '/');
  if (!/^packages\/[a-z0-9-]+$/u.test(packageDirectory)) {
    errors.push(`${manifest.name} has an unsafe package directory: ${packageDirectory}`);
    continue;
  }
  const result = process.platform === 'win32'
    ? spawnSync(
        process.env.ComSpec ?? 'cmd.exe',
        ['/d', '/s', '/c', `corepack pnpm --dir ${packageDirectory} pack --dry-run --json`],
        { cwd: root, encoding: 'utf8' },
      )
    : spawnSync(
        'corepack',
        ['pnpm', '--dir', packageDirectory, 'pack', '--dry-run', '--json'],
        { cwd: root, encoding: 'utf8' },
      );
  if (result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? 'unknown child process error';
    errors.push(`${manifest.name} pack dry-run failed: ${detail}`);
    continue;
  }

  const pack = JSON.parse(result.stdout);
  const files = new Set(pack.files.map(({ path }) => path.replaceAll('\\', '/')));
  for (const required of ['package.json', 'dist/index.js', 'dist/index.d.ts']) {
    if (!files.has(required)) errors.push(`${manifest.name} pack is missing ${required}`);
  }
  for (const path of files) {
    if (
      path.startsWith('src/') ||
      path.startsWith('test/') ||
      path.includes('/test/') ||
      path.startsWith('.env') ||
      path.endsWith('.tsbuildinfo')
    ) {
      errors.push(`${manifest.name} pack contains development file ${path}`);
    }
  }
  if (pack.name !== manifest.name || pack.version !== manifest.version) {
    errors.push(`${manifest.name} pack metadata does not match package.json`);
  }
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${packageCount} public package dry-runs contain only declared release files.\n`);
}
