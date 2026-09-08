import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createDraftFieldEvidence,
  createMemoryAttachmentStorageProvider,
  moderateFieldEvidence,
  patchDraftFieldEvidence,
  type FieldEvidenceRecord,
} from '../../packages/evidence/src/index.js';
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
      snapshotFormatVersion: '2.0.0',
      checkedAt: '2026-09-08T00:00:00.000Z',
      engineVersion: '0.1.0',
      ruleSetVersion: '0.1.0',
      policyVersion: '1.0.0',
      canonicalSchemaVersion: '3.0.0',
      installationContextSchemaVersion: '2.0.0',
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
  const fieldEvidence: FieldEvidenceRecord = {
    schemaVersion: '3.0.0',
    evidenceId: 'field-1',
    status: 'DRAFT',
    visibility: 'PUBLIC',
    redaction: 'NONE',
    outcome: 'ASSEMBLY_FAILURE',
    issueType: 'PHYSICAL_CLEARANCE',
    parts: [
      { category: 'GPU', partId: '11111111-1111-4111-8111-111111111111' },
    ],
    installationContext: validCheckRequest.installationContext as unknown as FieldEvidenceRecord['installationContext'],
    attachments: [
      {
        attachmentId: 'demo-photo-1',
        mediaType: 'image/png',
        checksum: `sha256:${'a'.repeat(64)}`,
        sizeBytes: 4,
        storageKey: 'memory:demo-photo-1',
      },
    ],
    reportedAt: '2026-09-08T00:00:00.000Z',
    createdByPrincipalId: 'fixture-writer',
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
  };
  const fieldEvidenceStore = new Map([[fieldEvidence.evidenceId, fieldEvidence]]);
  const services = {
    checkCompatibility: vi.fn(async () => resultSnapshot),
    checkCompatibilityBatch: vi.fn(async () => ({ results: [resultSnapshot] })),
    listParts: vi.fn(async (query: { readonly limit?: number; readonly offset?: number }) => ({
      items: [],
      total: 0,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    })),
    getPart: vi.fn(async () => undefined),
    getEvidence: vi.fn(async (evidenceId: string) => {
      if (evidenceId === 'staff-only') {
        return { ...fieldEvidence, evidenceId, visibility: 'STAFF_ONLY' as const };
      }
      return fieldEvidenceStore.get(evidenceId);
    }),
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
      {
        capabilityId: 'socket',
        title: 'Socket',
        providerAvailable: true,
        defaultMode: 'REQUIRED',
      },
    ]),
    listProfiles: vi.fn(async () => [validCheckRequest.policyProfile]),
    createFieldEvidence: vi.fn(async (input, audit) => {
      const created = createDraftFieldEvidence(input, audit);
      fieldEvidenceStore.set(created.evidenceId, created);
      return created;
    }),
    patchFieldEvidence: vi.fn(async (evidenceId, patch, audit) => {
      const current = fieldEvidenceStore.get(evidenceId);
      if (!current) return undefined;
      const updated = patchDraftFieldEvidence(current, patch, audit);
      fieldEvidenceStore.set(evidenceId, updated);
      return updated;
    }),
    moderateFieldEvidence: vi.fn(async (evidenceId, moderation) => {
      const current = fieldEvidenceStore.get(evidenceId);
      if (!current) return undefined;
      const updated = moderateFieldEvidence(current, moderation);
      fieldEvidenceStore.set(evidenceId, updated);
      return updated;
    }),
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
  const attachmentStorageProvider = createMemoryAttachmentStorageProvider();
  await attachmentStorageProvider.put({
    reference: fieldEvidence.attachments![0]!,
    data: new Uint8Array([1, 2, 3, 4]),
  });
  const server = await (candidate as ServerFactory)({
    services,
    attachmentStorageProvider,
    clock: () => '2026-09-09T01:00:00.000Z',
    logger: false,
    ...serverOptions,
  });
  servers.push(server);
  return { server, services };
}

const validCheckRequest = {
  build: { schemaVersion: '3.0.0', parts: [] },
  intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
  installationContext: {
    schemaVersion: '2.0.0',
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
} as const;

describe('Fastify reference API', () => {
  test('reports health and canonical schema version', async () => {
    const { server } = await createServer();
    const response = await server.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'pcpartcheck',
      canonicalSchemaVersion: '3.0.0',
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
      canonicalSchemaVersion: '3.0.0',
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
      method: 'POST',
      url: '/v1/field-evidence/similar',
      payload: {
        issueType: 'PHYSICAL_CLEARANCE',
        parts: [],
        installationContext: validCheckRequest.installationContext,
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
    expect(parts.json()).toEqual({
      items: [], total: 0, limit: 50, offset: 0,
    });
    expect(evidence.statusCode).toBe(200);
    expect(evidence.json()).toMatchObject({
      evidenceId: 'field-1',
      visibility: 'PUBLIC',
      redaction: 'NONE',
    });
    expect(capabilities.json()).toEqual([
      {
        capabilityId: 'socket',
        title: 'Socket',
        providerAvailable: true,
        defaultMode: 'REQUIRED',
      },
    ]);
    expect(profiles.json()).toEqual([validCheckRequest.policyProfile]);
  });

  test('bounds parts pagination and forwards limit plus offset', async () => {
    const { server, services } = await createServer();
    const page = await server.inject({
      method: 'GET',
      url: '/v1/parts?limit=25&offset=50&search=demo',
    });
    const overLimit = await server.inject({
      method: 'GET',
      url: '/v1/parts?limit=101',
    });

    expect(page.statusCode).toBe(200);
    expect(page.json()).toMatchObject({ limit: 25, offset: 50 });
    expect(services.listParts).toHaveBeenCalledWith(expect.objectContaining({
      limit: 25, offset: 50, search: 'demo',
    }));
    expect(overLimit.statusCode).toBe(400);
  });

  test('enforces draft-only writes and separate moderation authorization', async () => {
    const createAuthorizationProvider = (
      httpServer as Readonly<Record<string, unknown>>
    ).createMemoryAuthorizationProvider as (grants: readonly unknown[]) => unknown;
    const authorizationProvider = createAuthorizationProvider([
      {
        credential: 'Bearer staff-token',
        principalId: 'staff-1',
        actions: ['FIELD_EVIDENCE_WRITE', 'FIELD_EVIDENCE_READ_STAFF'],
      },
      {
        credential: 'Bearer admin-token',
        principalId: 'admin-1',
        actions: ['FIELD_EVIDENCE_WRITE', 'FIELD_EVIDENCE_MODERATE'],
      },
    ]);
    const { server } = await createServer({ authorizationProvider });
    const createPayload = {
      evidenceId: 'field-1',
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
    const draftPatch = await server.inject({
      method: 'PATCH',
      url: '/v1/field-evidence/field-1',
      headers: { authorization: 'Bearer staff-token' },
      payload: { redaction: 'NONE' },
    });
    const forbidden = await server.inject({
      method: 'POST',
      url: '/v1/field-evidence/field-1/approve',
      headers: { authorization: 'Bearer staff-token' },
      payload: {},
    });
    const approved = await server.inject({
      method: 'POST',
      url: '/v1/field-evidence/field-1/approve',
      headers: { authorization: 'Bearer admin-token' },
    });
    const immutablePatch = await server.inject({
      method: 'PATCH',
      url: '/v1/field-evidence/field-1',
      headers: { authorization: 'Bearer staff-token' },
      payload: {
        outcome: 'ASSEMBLY_SUCCESS',
        parts: [
          { category: 'CPU', partId: '22222222-2222-4222-8222-222222222222' },
        ],
        installationContext: { schemaVersion: '2.0.0' },
      },
    });
    const repeatApproval = await server.inject({
      method: 'POST',
      url: '/v1/field-evidence/field-1/approve',
      headers: { authorization: 'Bearer admin-token' },
      payload: {},
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      status: 'DRAFT',
      createdByPrincipalId: 'staff-1',
      createdAt: '2026-09-09T01:00:00.000Z',
    });
    expect(draftPatch.statusCode).toBe(200);
    expect(draftPatch.json()).toMatchObject({
      status: 'DRAFT',
      redaction: 'NONE',
      updatedAt: '2026-09-09T01:00:00.000Z',
    });
    expect(forbidden.statusCode).toBe(403);
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({
      status: 'APPROVED',
      moderatedByPrincipalId: 'admin-1',
      moderatedAt: '2026-09-09T01:00:00.000Z',
    });
    expect(immutablePatch.statusCode).toBe(409);
    expect(repeatApproval.statusCode).toBe(409);
    expect((await server.inject({
      method: 'GET',
      url: '/v1/evidence/field-1',
      headers: { authorization: 'Bearer staff-token' },
    })).json()).toMatchObject({
      outcome: 'ASSEMBLY_FAILURE',
      parts: createPayload.parts,
      installationContext: createPayload.installationContext,
    });
  });

  test('rejects a draft and prevents patch or direct rejected-to-approved promotion', async () => {
    const createAuthorizationProvider = (
      httpServer as Readonly<Record<string, unknown>>
    ).createMemoryAuthorizationProvider as (grants: readonly unknown[]) => unknown;
    const authorizationProvider = createAuthorizationProvider([
      {
        credential: 'Bearer writer-token',
        principalId: 'writer-1',
        actions: ['FIELD_EVIDENCE_WRITE'],
      },
      {
        credential: 'Bearer admin-token',
        principalId: 'admin-1',
        actions: ['FIELD_EVIDENCE_MODERATE'],
      },
    ]);
    const { server } = await createServer({ authorizationProvider });
    const rejected = await server.inject({
      method: 'POST',
      url: '/v1/field-evidence/field-1/reject',
      headers: { authorization: 'Bearer admin-token' },
      payload: { reason: '사진으로 부품을 확인할 수 없습니다.' },
    });
    const patch = await server.inject({
      method: 'PATCH',
      url: '/v1/field-evidence/field-1',
      headers: { authorization: 'Bearer writer-token' },
      payload: { redaction: 'NONE' },
    });
    const approve = await server.inject({
      method: 'POST',
      url: '/v1/field-evidence/field-1/approve',
      headers: { authorization: 'Bearer admin-token' },
      payload: {},
    });

    expect(rejected.statusCode).toBe(200);
    expect(rejected.json()).toMatchObject({
      status: 'REJECTED',
      moderationReason: '사진으로 부품을 확인할 수 없습니다.',
      moderatedByPrincipalId: 'admin-1',
    });
    expect(patch.statusCode).toBe(409);
    expect(approve.statusCode).toBe(409);
  });

  test('serves linked attachments through the evidence visibility boundary', async () => {
    const createAuthorizationProvider = (
      httpServer as Readonly<Record<string, unknown>>
    ).createMemoryAuthorizationProvider as (grants: readonly unknown[]) => unknown;
    const authorizationProvider = createAuthorizationProvider([
      {
        credential: 'Bearer reader-token',
        principalId: 'reader-1',
        actions: ['FIELD_EVIDENCE_READ_STAFF'],
      },
    ]);
    const { server } = await createServer({ authorizationProvider });
    const publicAttachment = await server.inject({
      method: 'GET',
      url: '/v1/field-evidence/field-1/attachments/demo-photo-1',
    });
    const denied = await server.inject({
      method: 'GET',
      url: '/v1/field-evidence/staff-only/attachments/demo-photo-1',
    });
    const allowed = await server.inject({
      method: 'GET',
      url: '/v1/field-evidence/staff-only/attachments/demo-photo-1',
      headers: { authorization: 'Bearer reader-token' },
    });

    expect(publicAttachment.statusCode).toBe(200);
    expect(publicAttachment.json()).toMatchObject({
      reference: { attachmentId: 'demo-photo-1', mediaType: 'image/png' },
      contentBase64: 'AQIDBA==',
    });
    expect(denied.statusCode).toBe(401);
    expect(allowed.statusCode).toBe(200);
  });

  test('maps staff-only evidence reads through the authorization provider', async () => {
    const createAuthorizationProvider = (
      httpServer as Readonly<Record<string, unknown>>
    ).createMemoryAuthorizationProvider as (grants: readonly unknown[]) => unknown;
    const authorizationProvider = createAuthorizationProvider([
      {
        credential: 'Bearer reader-token',
        principalId: 'reader-1',
        actions: ['FIELD_EVIDENCE_READ_STAFF'],
      },
    ]);
    const { server } = await createServer({ authorizationProvider });

    const denied = await server.inject({
      method: 'GET',
      url: '/v1/evidence/staff-only',
    });
    const allowed = await server.inject({
      method: 'GET',
      url: '/v1/evidence/staff-only',
      headers: { authorization: 'Bearer reader-token' },
    });

    expect(denied.statusCode).toBe(401);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({ visibility: 'STAFF_ONLY' });
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
        '/v1/field-evidence/{id}/reject': expect.any(Object),
        '/v1/field-evidence/{id}/attachments/{attachmentId}': expect.any(Object),
        '/v1/demo': expect.any(Object),
      },
    });
    expect(
      (openapi.json() as { paths: Record<string, Record<string, unknown>> })
        .paths['/v1/field-evidence/similar'],
    ).toHaveProperty('post');
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
