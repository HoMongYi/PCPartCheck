import { readFile } from 'node:fs/promises';

import { expect, test } from 'vitest';

async function source(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

test('Reference API image is multi-stage, production-only, non-root, and healthy', async () => {
  const dockerfile = await source('apps/reference-api/Dockerfile');

  expect(dockerfile).toMatch(/^FROM node:24\.13\.1-bookworm-slim AS build$/mu);
  expect(dockerfile).toContain('deploy --prod --legacy');
  expect(dockerfile).toContain('USER node');
  expect(dockerfile).toContain('HEALTHCHECK');
  expect(dockerfile).toContain('CMD ["node", "dist/main.js"]');
});

test('Demo image uses the production standalone build as a non-root user', async () => {
  const [dockerfile, nextConfig] = await Promise.all([
    source('apps/demo-web/Dockerfile'),
    source('apps/demo-web/next.config.ts'),
  ]);

  expect(nextConfig).toContain("process.env.PCPARTCHECK_STANDALONE === 'true'");
  expect(dockerfile).toMatch(/^FROM node:24\.13\.1-bookworm-slim AS build$/mu);
  expect(dockerfile).toContain('ENV PCPARTCHECK_STANDALONE=true');
  expect(dockerfile).toContain('.next/standalone');
  expect(dockerfile).toContain('USER node');
  expect(dockerfile).toContain('HEALTHCHECK');
});

test('Compose connects the Demo to the API and declares service health checks', async () => {
  const compose = await source('docker-compose.yml');

  expect(compose).toContain('PCPARTCHECK_API_URL: http://reference-api:3001/v1/demo');
  expect(compose).toContain('condition: service_healthy');
  expect(compose.match(/healthcheck:/gu)).toHaveLength(2);
  expect(compose).not.toContain('sqlite');
});

test('Docker context excludes secrets, fixtures, dependencies, and build output', async () => {
  const dockerignore = await source('.dockerignore');

  for (const entry of ['.env', 'node_modules', '**/test/', 'tests/', '**/dist/', '**/.next/']) {
    expect(dockerignore).toContain(entry);
  }
});

test('Docker builders include the native toolchain required by workspace installs', async () => {
  const dockerfiles = await Promise.all([
    source('apps/reference-api/Dockerfile'),
    source('apps/demo-web/Dockerfile'),
  ]);

  for (const dockerfile of dockerfiles) {
    expect(dockerfile).toContain('python3 make g++');
  }
});
