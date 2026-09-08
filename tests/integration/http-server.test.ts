import { afterEach, describe, expect, test, vi } from 'vitest';

import * as httpServer from '../../packages/http-server/src/index.js';

interface TestResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
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

async function createServer(
  serverOptions: Readonly<Record<string, unknown>> = {},
) {
  const candidate = (httpServer as Readonly<Record<string, unknown>>)
    .buildHttpServer;
  expect(candidate, 'buildHttpServer must be exported').toBeTypeOf('function');
  const resultSnapshot = {
      snapshotFormatVersion: '1.0.0',
      checkedAt: '2026-09-08T00:00:00.000Z',
      engineVersion: '0.1.0',
      ruleSetVersion: '0.1.0',
      policyVersion: '1.0.0',
      canonicalSchemaVersion: '2.0.0',
      identityMapperVersion: '1.1.0',
      providerVersions: [],
      inputSnapshot: {
        build: validCheckRequest.build,
        intent: validCheckRequest.intent,
        installationContext: validCheckRequest.installationContext,
        policyProfile: validCheckRequest.policyProfile,
      },
      evidenceSnapshot: {},
      resultSnapshot: {
        status: 'PASS',
        decision: 'ALLOW',
        coverage: {
          required: { total: 0, evaluated: 0, unknown: 0, notChecked: 0 },
          advisory: { total: 0, evaluated: 0, unknown: 0, notChecked: 0 },
          disabled: { total: 0, notChecked: 0 },
        },
        issues: {
          blockingRuleIds: [],
          reviewRuleIds: [],
          advisoryRuleIds: [],
        },
        ruleResults: [],
      },
    } as const;
  const fieldEvidence = {
    schemaVersion: '2.0.0',
    evidenceId: 'field-1',
    status: 'DRAFT',
    visibility: 'PUBLIC',
    redaction: 'NONE',
    outcome: 'ASSEMBLY_FAILURE',
    issueType: 'PHYSICAL_CLEARANCE',
    parts: [
      { category: 'GPU', partId: '11111111-1111-4111-8111-111111111111' },
    ],
    installationContext: validCheckRequest.installationContext,
    reportedAt: '2026-09-08T00:00:00.000Z',
  } as const;
  const services = {
    checkCompatibility: vi.fn(async () => resultSnapshot),
    checkCompatibilityBatch: vi.fn(async () => ({ results: [resultSnapshot] })),
    listParts: vi.fn(async () => ({ items: [], total: 0 })),
    getPart: vi.fn(async () => undefined),
    getEvidence: vi.fn(async () => fieldEvidence),
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
    listCapabilities: vi.fn(async () => [
      { capabilityId: 'socket', title: 'Socket' },
    ]),
    listProfiles: vi.fn(async () => [validCheckRequest.policyProfile]),
    createFieldEvidence: vi.fn(async () => fieldEvidence),
    patchFieldEvidence: vi.fn(async () => fieldEvidence),
    approveFieldEvidence: vi.fn(async () => ({
      ...fieldEvidence,
      status: 'APPROVED' as const,
    })),
    getDemoDashboard: vi.fn(async () => ({
      scenarios: [
        {
          id: 'compatible-platform',
          title: '기본 부품이 모두 맞는 구성',
          summary: '필수 규칙이 모두 통과한 예시입니다.',
          status: 'PASS',
          decision: 'ALLOW',
          blockingRuleIds: [],
          reviewRuleIds: [],
          advisoryRuleIds: [],
          coverage: {
            required: { total: 0, evaluated: 0, unknown: 0, notChecked: 0 },
            advisory: { total: 0, evaluated: 0, unknown: 0, notChecked: 0 },
            disabled: { total: 0, notChecked: 0 },
          },
          ruleResults: [],
          capabilities: [],
        },
      ],
      exactEvidence: {
        evidenceId: 'exact-1',
        issueType: 'PHYSICAL_CLEARANCE',
        fieldEvidenceStatus: 'APPROVED',
        visibility: 'PUBLIC',
        redaction: 'NONE',
        outcome: 'ASSEMBLY_FAILURE',
        match: 'EXACT',
        resultStatus: 'INCOMPATIBLE',
      },
      similarEvidence: [
        {
          evidenceId: 'similar-1',
          issueType: 'PHYSICAL_CLEARANCE',
          similarityScore: 0.925,
          matchedFields: ['parts.PC_CASE'],
          differences: ['measurements.gpu.lengthMm'],
          reason: '같은 케이스와 라디에이터 배치를 사용했습니다.',
        },
      ],
    })),
  };
  const server = await (candidate as ServerFactory)({
    services,
    logger: false,
    ...serverOptions,
  });
  servers.push(server);
  return { server, services };
}

const validCheckRequest = {
  build: { schemaVersion: '2.0.0', parts: [] },
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
      canonicalSchemaVersion: '2.0.0',
    });
  });

  test('validates and delegates compatibility checks', async () => {
    const { server, services } = await createServer();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/compatibility/check',
      payload: validCheckRequest,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      canonicalSchemaVersion: '2.0.0',
      resultSnapshot: { decision: 'ALLOW' },
    });
    expect(services.checkCompatibility).toHaveBeenCalledOnce();
  });

  test('rejects invalid canonical requests before invoking the service', async () => {
    const { server, services } = await createServer();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/compatibility/check',
      payload: { ...validCheckRequest, build: { schemaVersion: '1.0.0', parts: [] } },
    });

    expect(response.statusCode).toBe(400);
    expect(services.checkCompatibility).not.toHaveBeenCalled();
  });

  test('checks a bounded batch through the same versioned contract', async () => {
    const { server, services } = await createServer();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/compatibility/check-batch',
      payload: { requests: [validCheckRequest] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      results: [{ resultSnapshot: { status: 'PASS', decision: 'ALLOW' } }],
    });
    expect(services.checkCompatibilityBatch).toHaveBeenCalledOnce();
  });

  test('returns consumer-safe Similar Evidence fields without a decision', async () => {
    const { server } = await createServer();
    const response = await server.inject({
      method: 'GET',
      url: `/v1/field-evidence/similar?input=${encodeURIComponent(JSON.stringify({
        issueType: 'PHYSICAL_CLEARANCE',
        parts: [],
        installationContext: validCheckRequest.installationContext,
      }))}`,
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

  test('returns engine-backed demo scenarios and reference-only similar evidence', async () => {
    const { server } = await createServer();
    const response = await server.inject({ method: 'GET', url: '/v1/demo' });
    const payload = response.json() as {
      readonly similarEvidence: readonly Readonly<Record<string, unknown>>[];
    };

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      scenarios: [{ id: 'compatible-platform', status: 'PASS', decision: 'ALLOW' }],
      similarEvidence: [{ evidenceId: 'similar-1', issueType: 'PHYSICAL_CLEARANCE' }],
    });
    expect(payload.similarEvidence[0]).not.toHaveProperty('decision');
    expect(payload.similarEvidence[0]).not.toHaveProperty('status');
  });

  test('serves provider-neutral parts, evidence, capabilities, and profiles', async () => {
    const { server } = await createServer();
    const [parts, evidence, capabilities, profiles] = await Promise.all([
      server.inject({ method: 'GET', url: '/v1/parts?category=GPU' }),
      server.inject({ method: 'GET', url: '/v1/evidence/field-1' }),
      server.inject({ method: 'GET', url: '/v1/capabilities' }),
      server.inject({ method: 'GET', url: '/v1/profiles' }),
    ]);

    expect(parts.statusCode).toBe(200);
    expect(parts.json()).toEqual({ items: [], total: 0 });
    expect(evidence.statusCode).toBe(200);
    expect(evidence.json()).toMatchObject({
      evidenceId: 'field-1',
      visibility: 'PUBLIC',
      redaction: 'NONE',
    });
    expect(capabilities.json()).toEqual([
      { capabilityId: 'socket', title: 'Socket' },
    ]);
    expect(profiles.json()).toEqual([validCheckRequest.policyProfile]);
  });

  test('requires separate write and approve authorization actions', async () => {
    const createAuthorizationProvider = (
      httpServer as Readonly<Record<string, unknown>>
    ).createMemoryAuthorizationProvider as (grants: readonly unknown[]) => unknown;
    const authorizationProvider = createAuthorizationProvider([
      {
        credential: 'Bearer staff-token',
        principalId: 'staff-1',
        actions: ['FIELD_EVIDENCE_WRITE'],
      },
      {
        credential: 'Bearer admin-token',
        principalId: 'admin-1',
        actions: ['FIELD_EVIDENCE_WRITE', 'FIELD_EVIDENCE_APPROVE'],
      },
    ]);
    const { server } = await createServer({ authorizationProvider });
    const createPayload = {
      schemaVersion: '2.0.0',
      evidenceId: 'field-1',
      status: 'DRAFT',
      visibility: 'STAFF_ONLY',
      redaction: 'ANONYMIZED',
      outcome: 'ASSEMBLY_FAILURE',
      issueType: 'PHYSICAL_CLEARANCE',
      parts: [
        { category: 'GPU', partId: '11111111-1111-4111-8111-111111111111' },
      ],
      installationContext: validCheckRequest.installationContext,
      reportedAt: '2026-09-08T00:00:00.000Z',
    };

    const unauthenticated = await server.inject({
      method: 'POST',
      url: '/v1/field-evidence',
      payload: createPayload,
    });
    const created = await server.inject({
      method: 'POST',
      url: '/v1/field-evidence',
      headers: { authorization: 'Bearer staff-token' },
      payload: createPayload,
    });
    const forbidden = await server.inject({
      method: 'POST',
      url: '/v1/field-evidence/field-1/approve',
      headers: { authorization: 'Bearer staff-token' },
    });
    const approved = await server.inject({
      method: 'POST',
      url: '/v1/field-evidence/field-1/approve',
      headers: { authorization: 'Bearer admin-token' },
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(created.statusCode).toBe(201);
    expect(forbidden.statusCode).toBe(403);
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: 'APPROVED' });
  });

  test('returns 429 and Retry-After through the memory rate limiter', async () => {
    const createRateLimitProvider = (
      httpServer as Readonly<Record<string, unknown>>
    ).createMemoryRateLimitProvider as (options: Readonly<Record<string, unknown>>) => unknown;
    const rateLimitProvider = createRateLimitProvider({
      maxRequests: 2,
      windowMs: 60_000,
      clock: () => 0,
    });
    const { server } = await createServer({ rateLimitProvider });

    await server.inject({ method: 'GET', url: '/v1/capabilities' });
    await server.inject({ method: 'GET', url: '/v1/capabilities' });
    const limited = await server.inject({
      method: 'GET',
      url: '/v1/capabilities',
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBe('60');
    expect(limited.json()).toMatchObject({ error: 'RATE_LIMITED' });
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
        '/v1/compatibility/check': expect.any(Object),
        '/v1/compatibility/check-batch': expect.any(Object),
        '/v1/parts': expect.any(Object),
        '/v1/parts/{id}': expect.any(Object),
        '/v1/evidence/{id}': expect.any(Object),
        '/v1/field-evidence/similar': expect.any(Object),
        '/v1/capabilities': expect.any(Object),
        '/v1/profiles': expect.any(Object),
        '/v1/field-evidence': expect.any(Object),
        '/v1/field-evidence/{id}': expect.any(Object),
        '/v1/field-evidence/{id}/approve': expect.any(Object),
        '/v1/demo': expect.any(Object),
      },
    });
    expect(docs.statusCode).toBe(200);
  });

  test('exports provider-neutral memory authorization and rate-limit references', () => {
    expect(
      (httpServer as Readonly<Record<string, unknown>>)
        .createMemoryAuthorizationProvider,
    ).toBeTypeOf('function');
    expect(
      (httpServer as Readonly<Record<string, unknown>>)
        .createMemoryRateLimitProvider,
    ).toBeTypeOf('function');
  });
});
