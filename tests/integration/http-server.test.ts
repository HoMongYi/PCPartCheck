import { afterEach, describe, expect, test, vi } from 'vitest';

import * as httpServer from '../../packages/http-server/src/index.js';

interface TestResponse {
  readonly statusCode: number;
  json(): unknown;
}

interface TestServer {
  inject(options: Readonly<Record<string, unknown>>): Promise<TestResponse>;
  close(): Promise<void>;
}

type ServerFactory = (options: Readonly<Record<string, unknown>>) => Promise<TestServer>;

const servers: TestServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function createServer() {
  const candidate = (httpServer as Readonly<Record<string, unknown>>)
    .buildHttpServer;
  expect(candidate, 'buildHttpServer must be exported').toBeTypeOf('function');
  const services = {
    checkCompatibility: vi.fn(async () => ({
      snapshotFormatVersion: '1.0.0',
      checkedAt: '2026-09-08T00:00:00.000Z',
      engineVersion: '0.1.0',
      ruleSetVersion: '0.1.0',
      policyVersion: '1.0.0',
      canonicalSchemaVersion: '1.1.0',
      identityMapperVersion: '1.0.0',
      providerVersions: [],
      inputSnapshot: {},
      evidenceSnapshot: {},
      resultSnapshot: {
        status: 'PASS',
        decision: 'ALLOW',
        coverage: {},
        issues: {},
        ruleResults: [],
      },
    })),
    findSimilarEvidence: vi.fn(async () => [
      {
        evidenceId: 'similar-1',
        issueType: 'PHYSICAL_CLEARANCE',
        similarityScore: 0.925,
        matchedFields: ['parts.PC_CASE'],
        differences: ['measurements.gpu.lengthMm'],
        reason: '같은 케이스와 라디에이터 배치를 사용했습니다.',
      },
    ]),
  };
  const server = await (candidate as ServerFactory)({ services, logger: false });
  servers.push(server);
  return { server, services };
}

const validCheckRequest = {
  build: { schemaVersion: '1.1.0', parts: [] },
  intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
  installationContext: {
    schemaVersion: '1.0.0',
    radiators: [],
    hddCages: [],
    gpuOrientation: 'HORIZONTAL',
    occupiedPcieSlotIds: [],
    pciePower: {
      independentCableCount: 0,
      native12VhpwrCableCount: 0,
      native12V2x6CableCount: 0,
      adapterUsed: false,
    },
  },
  policyProfile: {
    profileId: 'reference',
    policyVersion: '1.0.0',
    capabilities: [],
  },
  evidenceSnapshot: {},
};

describe('Fastify reference API', () => {
  test('reports health and canonical schema version', async () => {
    const { server } = await createServer();
    const response = await server.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'pcpartcheck',
      canonicalSchemaVersion: '1.1.0',
    });
  });

  test('validates and delegates compatibility checks', async () => {
    const { server, services } = await createServer();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/checks',
      payload: validCheckRequest,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      canonicalSchemaVersion: '1.1.0',
      resultSnapshot: { decision: 'ALLOW' },
    });
    expect(services.checkCompatibility).toHaveBeenCalledOnce();
  });

  test('rejects invalid canonical requests before invoking the service', async () => {
    const { server, services } = await createServer();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/checks',
      payload: { ...validCheckRequest, build: { schemaVersion: '1.0.0', parts: [] } },
    });

    expect(response.statusCode).toBe(400);
    expect(services.checkCompatibility).not.toHaveBeenCalled();
  });

  test('returns consumer-safe Similar Evidence fields without a decision', async () => {
    const { server } = await createServer();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/evidence/similar',
      payload: {
        issueType: 'PHYSICAL_CLEARANCE',
        parts: [],
        installationContext: validCheckRequest.installationContext,
        records: [],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        evidenceId: 'similar-1',
        issueType: 'PHYSICAL_CLEARANCE',
        similarityScore: 0.925,
        matchedFields: ['parts.PC_CASE'],
        differences: ['measurements.gpu.lengthMm'],
        reason: '같은 케이스와 라디에이터 배치를 사용했습니다.',
      },
    ]);
    expect(response.json()).not.toHaveProperty('decision');
  });

  test('publishes OpenAPI paths and Swagger UI', async () => {
    const { server } = await createServer();
    const openapi = await server.inject({ method: 'GET', url: '/openapi.json' });
    const docs = await server.inject({ method: 'GET', url: '/docs/' });

    expect(openapi.statusCode).toBe(200);
    expect(openapi.json()).toMatchObject({
      openapi: expect.stringMatching(/^3\./u),
      paths: {
        '/health': expect.any(Object),
        '/v1/checks': expect.any(Object),
        '/v1/evidence/similar': expect.any(Object),
      },
    });
    expect(docs.statusCode).toBe(200);
  });
});
