import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  ApiErrorResponseSchema,
  CapabilitiesResponseSchema,
  CanonicalPartResponseSchema,
  CompatibilityCheckBatchRequestSchema,
  CompatibilityCheckBatchResponseSchema,
  CompatibilityCheckRequestSchema,
  DemoDashboardResponseSchema,
  EvidenceResponseSchema,
  FieldEvidencePatchSchema,
  FieldEvidenceRecordSchema,
  HealthResponseSchema,
  IdParamsSchema,
  PartsQuerySchema,
  PartsResponseSchema,
  ProfilesResponseSchema,
  ResultSnapshotResponseSchema,
  SimilarEvidenceLookupSchema,
  SimilarEvidenceQueryStringSchema,
  SimilarEvidenceResponseSchema,
  type AuthorizationAction,
  type AuthorizationProvider,
  type CompatibilityCheckBatchRequest,
  type CompatibilityCheckRequest,
  type FieldEvidenceRecord,
  type FieldEvidencePatch,
  type IdParams,
  type PartsQuery,
  type PcPartCheckApiServices,
  type RateLimitProvider,
  type SimilarEvidenceLookup,
  type SimilarEvidenceQueryString,
} from '@pcpartcheck/api-contracts';
import { Value } from '@sinclair/typebox/value';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';

import {
  createMemoryAuthorizationProvider,
  createMemoryRateLimitProvider,
} from './providers.js';

export interface BuildHttpServerOptions {
  readonly services: PcPartCheckApiServices;
  readonly authorizationProvider?: AuthorizationProvider;
  readonly rateLimitProvider?: RateLimitProvider;
  readonly logger?: FastifyServerOptions['logger'];
}

const commonErrors = {
  400: ApiErrorResponseSchema,
  401: ApiErrorResponseSchema,
  403: ApiErrorResponseSchema,
  404: ApiErrorResponseSchema,
  429: ApiErrorResponseSchema,
};

function error(errorCode: string, message: string) {
  return { error: errorCode, message };
}

async function authorize(
  provider: AuthorizationProvider,
  request: FastifyRequest,
  reply: FastifyReply,
  action: AuthorizationAction,
): Promise<boolean> {
  const credential = request.headers.authorization;
  const decision = await provider.authorize({
    action,
    ...(credential ? { credential } : {}),
  });
  if (decision.allowed) return true;
  const statusCode = decision.authenticated ? 403 : 401;
  await reply
    .code(statusCode)
    .send(error(statusCode === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
      statusCode === 401 ? 'Authentication is required' : 'Permission denied'));
  return false;
}

async function authorizeEvidenceRead(
  provider: AuthorizationProvider,
  request: FastifyRequest,
  reply: FastifyReply,
  evidence: FieldEvidenceRecord,
): Promise<boolean> {
  if (evidence.visibility === 'PUBLIC') return true;
  return authorize(
    provider,
    request,
    reply,
    evidence.visibility === 'ADMIN_ONLY'
      ? 'FIELD_EVIDENCE_READ_ADMIN'
      : 'FIELD_EVIDENCE_READ_STAFF',
  );
}

export async function buildHttpServer(
  options: BuildHttpServerOptions,
): Promise<FastifyInstance> {
  const server = Fastify({ logger: options.logger ?? false });
  const authorizationProvider =
    options.authorizationProvider ?? createMemoryAuthorizationProvider();
  const rateLimitProvider =
    options.rateLimitProvider ?? createMemoryRateLimitProvider();

  await server.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'PCPartCheck Reference API', version: '0.1.0' },
    },
  });
  await server.register(swaggerUi, { routePrefix: '/docs' });

  server.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/v1/')) return;
    const routeId = request.routeOptions.url ?? request.url.split('?')[0] ?? 'unknown';
    const decision = await rateLimitProvider.consume({
      key: request.ip,
      routeId,
    });
    if (decision.allowed) return;
    await reply
      .header('Retry-After', String(decision.retryAfterSeconds))
      .code(429)
      .send(error('RATE_LIMITED', 'Too many requests'));
  });

  server.get(
    '/health',
    { schema: { tags: ['system'], response: { 200: HealthResponseSchema } } },
    async () => ({
      status: 'ok' as const,
      service: 'pcpartcheck' as const,
      canonicalSchemaVersion: '2.0.0',
    }),
  );

  server.post(
    '/v1/compatibility/check',
    {
      schema: {
        tags: ['compatibility'],
        body: CompatibilityCheckRequestSchema,
        response: { 200: ResultSnapshotResponseSchema, ...commonErrors },
      },
    },
    async (request) =>
      options.services.checkCompatibility(
        request.body as CompatibilityCheckRequest,
      ),
  );

  server.post(
    '/v1/compatibility/check-batch',
    {
      schema: {
        tags: ['compatibility'],
        body: CompatibilityCheckBatchRequestSchema,
        response: { 200: CompatibilityCheckBatchResponseSchema, ...commonErrors },
      },
    },
    async (request) =>
      options.services.checkCompatibilityBatch(
        request.body as CompatibilityCheckBatchRequest,
      ),
  );

  server.get(
    '/v1/parts',
    {
      schema: {
        tags: ['parts'],
        querystring: PartsQuerySchema,
        response: { 200: PartsResponseSchema, ...commonErrors },
      },
    },
    async (request) => options.services.listParts(request.query as PartsQuery),
  );

  server.get(
    '/v1/parts/:id',
    {
      schema: {
        tags: ['parts'],
        params: IdParamsSchema,
        response: { 200: CanonicalPartResponseSchema, ...commonErrors },
      },
    },
    async (request, reply) => {
      const part = await options.services.getPart((request.params as IdParams).id);
      return part ?? reply.code(404).send(error('PART_NOT_FOUND', 'Part not found'));
    },
  );

  server.get(
    '/v1/evidence/:id',
    {
      schema: {
        tags: ['evidence'],
        params: IdParamsSchema,
        response: { 200: EvidenceResponseSchema, ...commonErrors },
      },
    },
    async (request, reply) => {
      const evidence = await options.services.getEvidence(
        (request.params as IdParams).id,
      );
      if (!evidence) {
        return reply.code(404).send(error('EVIDENCE_NOT_FOUND', 'Evidence not found'));
      }
      if ('visibility' in evidence) {
        const allowed = await authorizeEvidenceRead(
          authorizationProvider,
          request,
          reply,
          evidence,
        );
        if (!allowed) return reply;
      }
      return evidence;
    },
  );

  server.get(
    '/v1/field-evidence/similar',
    {
      schema: {
        tags: ['evidence'],
        querystring: SimilarEvidenceQueryStringSchema,
        response: { 200: SimilarEvidenceResponseSchema, ...commonErrors },
      },
    },
    async (request, reply) => {
      const { input } = request.query as SimilarEvidenceQueryString;
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch {
        return reply.code(400).send(error('INVALID_QUERY', 'input must be valid JSON'));
      }
      if (!Value.Check(SimilarEvidenceLookupSchema, parsed)) {
        return reply.code(400).send(error('INVALID_QUERY', 'input does not match the query schema'));
      }
      return options.services.findSimilarEvidence(parsed as SimilarEvidenceLookup);
    },
  );

  server.get(
    '/v1/capabilities',
    {
      schema: {
        tags: ['policy'],
        response: { 200: CapabilitiesResponseSchema, ...commonErrors },
      },
    },
    async () => options.services.listCapabilities(),
  );

  server.get(
    '/v1/profiles',
    {
      schema: {
        tags: ['policy'],
        response: { 200: ProfilesResponseSchema, ...commonErrors },
      },
    },
    async () => options.services.listProfiles(),
  );

  server.post(
    '/v1/field-evidence',
    {
      schema: {
        tags: ['evidence'],
        body: FieldEvidenceRecordSchema,
        response: { 201: FieldEvidenceRecordSchema, ...commonErrors },
      },
    },
    async (request, reply) => {
      if (!await authorize(authorizationProvider, request, reply, 'FIELD_EVIDENCE_WRITE')) {
        return reply;
      }
      const created = await options.services.createFieldEvidence(
        request.body as FieldEvidenceRecord,
      );
      return reply.code(201).send(created);
    },
  );

  server.patch(
    '/v1/field-evidence/:id',
    {
      schema: {
        tags: ['evidence'],
        params: IdParamsSchema,
        body: FieldEvidencePatchSchema,
        response: { 200: FieldEvidenceRecordSchema, ...commonErrors },
      },
    },
    async (request, reply) => {
      if (!await authorize(authorizationProvider, request, reply, 'FIELD_EVIDENCE_WRITE')) {
        return reply;
      }
      const updated = await options.services.patchFieldEvidence(
        (request.params as IdParams).id,
        request.body as FieldEvidencePatch,
      );
      return updated ?? reply.code(404).send(
        error('EVIDENCE_NOT_FOUND', 'Evidence not found'),
      );
    },
  );

  server.post(
    '/v1/field-evidence/:id/approve',
    {
      schema: {
        tags: ['evidence'],
        params: IdParamsSchema,
        response: { 200: FieldEvidenceRecordSchema, ...commonErrors },
      },
    },
    async (request, reply) => {
      if (!await authorize(authorizationProvider, request, reply, 'FIELD_EVIDENCE_APPROVE')) {
        return reply;
      }
      const approved = await options.services.approveFieldEvidence(
        (request.params as IdParams).id,
      );
      return approved ?? reply.code(404).send(
        error('EVIDENCE_NOT_FOUND', 'Evidence not found'),
      );
    },
  );

  server.get(
    '/v1/demo',
    {
      schema: {
        tags: ['demo'],
        response: { 200: DemoDashboardResponseSchema, ...commonErrors },
      },
    },
    async () => options.services.getDemoDashboard(),
  );

  server.get('/openapi.json', { schema: { hide: true } }, async () =>
    server.swagger(),
  );

  await server.ready();
  return server;
}
