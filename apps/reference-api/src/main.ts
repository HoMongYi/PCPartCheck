import { buildReferenceServer } from './server.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  throw new RangeError('PORT must be an integer between 1 and 65535');
}

const server = await buildReferenceServer({ logger: true });
await server.listen({ host: '0.0.0.0', port });
