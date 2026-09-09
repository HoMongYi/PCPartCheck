import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import { chromium } from '@playwright/test';

function findAvailablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : undefined;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

async function waitForUrl(url, child, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Demo Web exited before startup.\n${output.join('')}`);
    }
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) return;
    } catch {
      // Startup polling is condition-based; connection failures are expected here.
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${url}.\n${output.join('')}`);
}

const outputPath = resolve(process.argv[2] ?? 'docs/assets/demo-overview.png');
const { buildReferenceServer } = await import(
  new globalThis.URL('../apps/reference-api/dist/server.js', import.meta.url)
);
const api = await buildReferenceServer();
const apiAddress = await api.listen({ host: '127.0.0.1', port: 0 });
process.stdout.write(`Reference API ready at ${apiAddress}.\n`);
const webPort = await findAvailablePort();
const webUrl = `http://127.0.0.1:${webPort}`;
const childOutput = [];
const web = spawn(
  process.execPath,
  [
    resolve('apps/demo-web/node_modules/next/dist/bin/next'),
    'start',
    resolve('apps/demo-web'),
    '--hostname',
    '127.0.0.1',
    '--port',
    String(webPort),
  ],
  {
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      PCPARTCHECK_API_URL: `${apiAddress}/v1/demo`,
      PCPARTCHECK_PUBLIC_API_URL: `${apiAddress}/docs/`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
web.stdout.on('data', (chunk) => childOutput.push(chunk.toString()));
web.stderr.on('data', (chunk) => childOutput.push(chunk.toString()));
web.on('error', (error) => childOutput.push(`${error.stack ?? error.message}\n`));

let browser;
try {
  await waitForUrl(webUrl, web, childOutput);
  process.stdout.write(`Demo Web ready at ${webUrl}.\n`);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    viewport: { width: 1440, height: 1100 },
  });
  await page.goto(webUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '합성 조립 시나리오' }).waitFor();
  await mkdir(dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath, fullPage: true });
  process.stdout.write(`Captured production Demo screenshot at ${outputPath}.\n`);
} finally {
  await browser?.close();
  web.kill();
  await api.close();
}
