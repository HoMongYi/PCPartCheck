import type { JsonValue } from './canonical/primitives.js';
import type { PolicyProfile } from './capability.js';
import type { BuildIntent } from './build-intent.js';
import type { CanonicalBuild } from './build.js';
import type { InstallationContext } from './installation-context.js';
import type { AggregatedCompatibilityResult } from './result.js';

export const SNAPSHOT_FORMAT_VERSION = '1.0.0' as const;

export interface ProviderVersion {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly commitSha?: string;
  readonly schemaFingerprint?: string;
}

export interface EngineVersions {
  readonly engineVersion: string;
  readonly ruleSetVersion: string;
  readonly canonicalSchemaVersion: string;
  readonly identityMapperVersion: string;
  readonly providerVersions: readonly ProviderVersion[];
}

export interface CompatibilityCheckInput {
  readonly build: CanonicalBuild;
  readonly intent: BuildIntent;
  readonly installationContext: InstallationContext;
  readonly policyProfile: PolicyProfile;
  readonly evidenceSnapshot: JsonValue;
}

export type CompatibilityInputSnapshot = Omit<
  CompatibilityCheckInput,
  'evidenceSnapshot'
>;

export interface ResultSnapshot extends EngineVersions {
  readonly snapshotFormatVersion: typeof SNAPSHOT_FORMAT_VERSION;
  readonly checkedAt: string;
  readonly policyVersion: string;
  readonly inputSnapshot: CompatibilityInputSnapshot;
  readonly evidenceSnapshot: JsonValue;
  readonly resultSnapshot: AggregatedCompatibilityResult;
}

export class ReplayVersionMismatchError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(`Replay version mismatch for ${field}`);
    this.name = 'ReplayVersionMismatchError';
    this.field = field;
  }
}

export class ReplayResultMismatchError extends Error {
  constructor() {
    super('Replay result does not match recorded result');
    this.name = 'ReplayResultMismatchError';
  }
}
