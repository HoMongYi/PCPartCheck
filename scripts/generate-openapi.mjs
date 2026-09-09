import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const outputPath = resolve(process.argv[2] ?? 'docs/openapi.json');
const { buildReferenceServer } = await import(
  new globalThis.URL('../apps/reference-api/dist/server.js', import.meta.url)
);
const server = await buildReferenceServer();

try {
  const response = await server.inject({ method: 'GET', url: '/openapi.json' });
  if (response.statusCode !== 200) {
    throw new Error(`GET /openapi.json returned ${response.statusCode}`);
  }
  const document = response.json();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  process.stdout.write(`Generated ${outputPath} from the Reference API runtime.\n`);
} finally {
  await server.close();
}
