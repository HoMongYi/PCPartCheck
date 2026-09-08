import type {
  AuthorizationAction,
  AuthorizationProvider,
  RateLimitProvider,
} from '@pcpartcheck/api-contracts';

export interface MemoryAuthorizationGrant {
  readonly credential: string;
  readonly principalId: string;
  readonly actions: readonly AuthorizationAction[];
}

export function createMemoryAuthorizationProvider(
  grants: readonly MemoryAuthorizationGrant[] = [],
): AuthorizationProvider {
  const byCredential = new Map(grants.map((grant) => [grant.credential, grant]));
  return {
    authorize: async ({ credential, action }) => {
      if (!credential) return { authenticated: false, allowed: false };
      const grant = byCredential.get(credential);
      if (!grant) return { authenticated: false, allowed: false };
      return {
        authenticated: true,
        allowed: grant.actions.includes(action),
        principalId: grant.principalId,
      };
    },
  };
}

export interface MemoryRateLimitOptions {
  readonly maxRequests?: number;
  readonly windowMs?: number;
  readonly clock?: () => number;
}

interface MemoryRateLimitEntry {
  count: number;
  resetAt: number;
}

export function createMemoryRateLimitProvider(
  options: MemoryRateLimitOptions = {},
): RateLimitProvider {
  const maxRequests = options.maxRequests ?? 100;
  const windowMs = options.windowMs ?? 60_000;
  const clock = options.clock ?? Date.now;
  const entries = new Map<string, MemoryRateLimitEntry>();

  if (!Number.isInteger(maxRequests) || maxRequests < 1) {
    throw new Error('maxRequests must be a positive integer');
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('windowMs must be positive');
  }

  return {
    consume: async ({ key, routeId }) => {
      const now = clock();
      const bucketKey = `${routeId}:${key}`;
      const current = entries.get(bucketKey);
      const entry = !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;
      entry.count += 1;
      entries.set(bucketKey, entry);
      return {
        allowed: entry.count <= maxRequests,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
      };
    },
  };
}
