import type {
  AuthorizationProvider,
  RateLimitProvider,
} from '@pcpartcheck/api-contracts';
import { buildHttpServer } from '@pcpartcheck/http-server';

import { createReferenceApiServices } from './services.js';

export function buildReferenceServer(
  options: {
    readonly authorizationProvider?: AuthorizationProvider;
    readonly rateLimitProvider?: RateLimitProvider;
    readonly logger?: boolean;
  } = {},
): ReturnType<typeof buildHttpServer> {
  return buildHttpServer({
    services: createReferenceApiServices(),
    logger: options.logger ?? false,
    ...(options.authorizationProvider
      ? { authorizationProvider: options.authorizationProvider }
      : {}),
    ...(options.rateLimitProvider
      ? { rateLimitProvider: options.rateLimitProvider }
      : {}),
  });
}
