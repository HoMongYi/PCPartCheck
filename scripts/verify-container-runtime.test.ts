import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { expect, test } from 'vitest';

interface RuntimeVerification {
  readonly health: {
    readonly canonicalSchemaVersion: string;
    readonly status: number;
  };
  readonly openapi: {
    readonly status: number;
    readonly version: string;
  };
  readonly web: {
    readonly apiDataMarker: string;
    readonly status: number;
  };
}

interface RuntimeVerifierModule {
  readonly verifyRuntimeEndpoints: (endpoints: {
    readonly healthUrl: string;
    readonly openapiUrl: string;
    readonly webUrl: string;
  }) => Promise<RuntimeVerification>;
}

test('verifies the running API, OpenAPI document, and API-backed Demo page', async () => {
  const server = createServer((request, response) => {
    response.statusCode = 200;
    if (request.url === '/health') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ canonicalSchemaVersion: '3.0.0' }));
      return;
    }
    if (request.url === '/openapi.json') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'PCPartCheck', version: '0.1.0' },
        paths: {},
      }));
      return;
    }
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end('<h1>PCPartCheck</h1><span>CANONICAL 3.0.0</span><article>socket-mismatch</article>');
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const moduleUrl = pathToFileURL(resolve('scripts/verify-container-runtime.mjs')).href;
    const { verifyRuntimeEndpoints } = (await import(moduleUrl)) as RuntimeVerifierModule;

    await expect(verifyRuntimeEndpoints({
      healthUrl: `${baseUrl}/health`,
      openapiUrl: `${baseUrl}/openapi.json`,
      webUrl: baseUrl,
    })).resolves.toEqual({
      health: { canonicalSchemaVersion: '3.0.0', status: 200 },
      openapi: { status: 200, version: '3.1.0' },
      web: { apiDataMarker: 'socket-mismatch', status: 200 },
    });
  } finally {
    await new Promise<void>((resolveClose, reject) => {
      server.close((error) => error ? reject(error) : resolveClose());
    });
  }
});
