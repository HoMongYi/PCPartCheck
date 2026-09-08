import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  CompatibilityCheckRequestSchema,
  DemoDashboardResponseSchema,
  HealthResponseSchema,
  ResultSnapshotResponseSchema,
  SimilarEvidenceRequestSchema,
  SimilarEvidenceResponseSchema,
  type CompatibilityCheckRequest,
  type PcPartCheckApiServices,
  type SimilarEvidenceRequest,
} from '@pcpartcheck/api-contracts';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

export interface BuildHttpServerOptions {
  readonly services: PcPartCheckApiServices;
  readonly logger?: FastifyServerOptions['logger'];
}

export async function buildHttpServer(
  options: BuildHttpServerOptions,
): Promise<FastifyInstance> {
  const server = Fastify({ logger: options.logger ?? false });

  await server.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'PCPartCheck Reference API',
        version: '0.1.0',
      },
    },
  });
  await server.register(swaggerUi, { routePrefix: '/docs' });

  server.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        response: { 200: HealthResponseSchema },
      },
    },
    async () => ({
      status: 'ok' as const,
      service: 'pcpartcheck' as const,
      canonicalSchemaVersion: '2.0.0',
    }),
  );

  server.post(
    '/v1/checks',
    {
      schema: {
        tags: ['compatibility'],
        body: CompatibilityCheckRequestSchema,
        response: { 200: ResultSnapshotResponseSchema },
      },
    },
    async (request) =>
      options.services.checkCompatibility(
        request.body as CompatibilityCheckRequest,
      ),
  );

  server.post(
    '/v1/evidence/similar',
    {
      schema: {
        tags: ['evidence'],
        body: SimilarEvidenceRequestSchema,
        response: { 200: SimilarEvidenceResponseSchema },
      },
    },
    async (request) =>
      options.services.findSimilarEvidence(request.body as SimilarEvidenceRequest),
  );

  server.get(
    '/v1/demo',
    {
      schema: {
        tags: ['demo'],
        response: { 200: DemoDashboardResponseSchema },
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
