import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const packages = [];
for (const entry of await readdir(resolve('packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifest = JSON.parse(
    await readFile(join(resolve('packages'), entry.name, 'package.json'), 'utf8'),
  );
  if (manifest.private !== true) packages.push({ name: manifest.name, version: manifest.version });
}

const outputPath = resolve(process.argv[2] ?? 'output/release/release-metadata.json');
const metadata = {
  releaseCandidate: 'v0.1.0',
  commitSha: process.env.GITHUB_SHA ?? 'local-working-tree',
  npmPublishEnabled: false,
  packages: packages.sort((left, right) => left.name.localeCompare(right.name)),
  versionDomains: {
    engine: '0.1.0',
    canonicalSchema: '3.0.0',
    installationContext: '2.0.0',
    fieldEvidence: '3.0.0',
    resultSnapshot: '2.0.0',
    ruleSet: '0.1.0',
    identityMapper: '1.1.0',
    buildCoresAdapter: '3.0.0',
    referencePolicy: '1.0.0',
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
process.stdout.write(`Created release metadata at ${outputPath}. npm publish remains disabled.\n`);
