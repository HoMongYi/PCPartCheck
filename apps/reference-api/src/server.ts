import type {
  AuthorizationProvider,
  RateLimitProvider,
} from '@pcpartcheck/api-contracts';
import { DEMO_ATTACHMENT_REFERENCE } from '@pcpartcheck/demo-data';
import { createMemoryAttachmentStorageProvider } from '@pcpartcheck/evidence';
import { buildHttpServer } from '@pcpartcheck/http-server';

import { createReferenceApiServices } from './services.js';

export async function buildReferenceServer(
  options: {
    readonly authorizationProvider?: AuthorizationProvider;
    readonly rateLimitProvider?: RateLimitProvider;
    readonly logger?: boolean;
  } = {},
): ReturnType<typeof buildHttpServer> {
  const attachmentStorageProvider = createMemoryAttachmentStorageProvider();
  await attachmentStorageProvider.put({
    reference: DEMO_ATTACHMENT_REFERENCE,
    data: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  return buildHttpServer({
    services: createReferenceApiServices(),
    attachmentStorageProvider,
    logger: options.logger ?? false,
    ...(options.authorizationProvider
      ? { authorizationProvider: options.authorizationProvider }
      : {}),
    ...(options.rateLimitProvider
      ? { rateLimitProvider: options.rateLimitProvider }
      : {}),
  });
}
