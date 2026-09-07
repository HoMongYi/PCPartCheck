import { buildHttpServer } from '@pcpartcheck/http-server';

import { createReferenceApiServices } from './services.js';

export function buildReferenceServer(
  options: { readonly logger?: boolean } = {},
): ReturnType<typeof buildHttpServer> {
  return buildHttpServer({
    services: createReferenceApiServices(),
    logger: options.logger ?? false,
  });
}
