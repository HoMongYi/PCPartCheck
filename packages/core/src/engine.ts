import { Value } from '@sinclair/typebox/value';

import { BuildIntentSchema, type BuildIntent } from './build-intent.js';
import { CanonicalBuildSchema, type CanonicalBuild } from './build.js';
import {
  PolicyProfileSchema,
  resolveCapabilityPolicy,
  type CapabilityPolicy,
  type PolicyProfile,
} from './capability.js';
import {
  CANONICAL_SCHEMA_VERSION,
  JsonValueSchema,
  type JsonValue,
} from './canonical/primitives.js';
import {
  INSTALLATION_CONTEXT_SCHEMA_VERSION,
  InstallationContextSchema,
  type InstallationContext,
} from './installation-context.js';
import { aggregateRuleResults, type RuleResult } from './result.js';
import type { CompatibilityRule } from './rule.js';
import {
  ReplayResultMismatchError,
  ReplayVersionMismatchError,
  SNAPSHOT_FORMAT_VERSION,
  type CompatibilityCheckInput,
  type EngineVersions,
  type ProviderVersion,
  type ResultSnapshot,
} from './snapshot.js';

export interface CompatibilityRuleContext {
  readonly build: CanonicalBuild;
  readonly intent: BuildIntent;
  readonly installationContext: InstallationContext;
  readonly policy: CapabilityPolicy;
}

export type EngineRule = CompatibilityRule<CompatibilityRuleContext>;

export interface CompatibilityEngineOptions {
  readonly rules: readonly EngineRule[];
  readonly versions: EngineVersions;
  readonly clock?: () => Date;
}

export interface CompatibilityEngine {
  check(input: CompatibilityCheckInput): Promise<ResultSnapshot>;
  replay(snapshot: ResultSnapshot): Promise<ResultSnapshot>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sortProviderVersions(
  versions: readonly ProviderVersion[],
): readonly ProviderVersion[] {
  return [...versions].sort((left, right) =>
    left.providerId.localeCompare(right.providerId),
  );
}

function assertUniqueIds(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function assertInput(input: CompatibilityCheckInput): void {
  if (!Value.Check(CanonicalBuildSchema, input.build)) {
    throw new Error('Invalid canonical build input');
  }
  if (!Value.Check(BuildIntentSchema, input.intent)) {
    throw new Error('Invalid build intent input');
  }
  if (!Value.Check(InstallationContextSchema, input.installationContext)) {
    throw new Error('Invalid installation context input');
  }
  if (!Value.Check(PolicyProfileSchema, input.policyProfile)) {
    throw new Error('Invalid policy profile input');
  }
  if (!Value.Check(JsonValueSchema, input.evidenceSnapshot)) {
    throw new Error('Invalid evidence snapshot input');
  }
  assertUniqueIds(
    input.policyProfile.capabilities.map(({ capabilityId }) => capabilityId),
    'capability policy',
  );
}

function assertRuntimeVersions(versions: EngineVersions): void {
  if (versions.canonicalSchemaVersion !== CANONICAL_SCHEMA_VERSION) {
    throw new Error(
      `Engine canonical schema ${versions.canonicalSchemaVersion} does not match ${CANONICAL_SCHEMA_VERSION}`,
    );
  }
  if (
    versions.installationContextSchemaVersion !==
    INSTALLATION_CONTEXT_SCHEMA_VERSION
  ) {
    throw new Error(
      `Engine installation context schema ${versions.installationContextSchemaVersion} does not match ${INSTALLATION_CONTEXT_SCHEMA_VERSION}`,
    );
  }
  assertUniqueIds(
    versions.providerVersions.map(({ providerId }) => providerId),
    'provider version',
  );
}

function assertReplayVersions(
  snapshot: ResultSnapshot,
  versions: EngineVersions,
): void {
  const pairs: ReadonlyArray<readonly [string, unknown, unknown]> = [
    ['snapshotFormatVersion', snapshot.snapshotFormatVersion, SNAPSHOT_FORMAT_VERSION],
    ['engineVersion', snapshot.engineVersion, versions.engineVersion],
    ['ruleSetVersion', snapshot.ruleSetVersion, versions.ruleSetVersion],
    [
      'canonicalSchemaVersion',
      snapshot.canonicalSchemaVersion,
      versions.canonicalSchemaVersion,
    ],
    [
      'installationContextSchemaVersion',
      snapshot.installationContextSchemaVersion,
      versions.installationContextSchemaVersion,
    ],
    [
      'installationContextSchemaVersion',
      snapshot.inputSnapshot.installationContext.schemaVersion,
      snapshot.installationContextSchemaVersion,
    ],
    [
      'identityMapperVersion',
      snapshot.identityMapperVersion,
      versions.identityMapperVersion,
    ],
    [
      'policyVersion',
      snapshot.policyVersion,
      snapshot.inputSnapshot.policyProfile.policyVersion,
    ],
    [
      'providerVersions',
      JSON.stringify(sortProviderVersions(snapshot.providerVersions)),
      JSON.stringify(sortProviderVersions(versions.providerVersions)),
    ],
  ];

  for (const [field, actual, expected] of pairs) {
    if (actual !== expected) throw new ReplayVersionMismatchError(field);
  }
}

async function evaluateRules(
  rules: readonly EngineRule[],
  profile: PolicyProfile,
  context: Omit<CompatibilityRuleContext, 'policy'>,
): Promise<readonly RuleResult[]> {
  const results: RuleResult[] = [];

  for (const rule of rules) {
    const policy = resolveCapabilityPolicy(profile, rule.capabilityId);
    if (policy.mode === 'DISABLED') {
      results.push({
        ruleId: rule.ruleId,
        capabilityId: rule.capabilityId,
        policyMode: policy.mode,
        status: 'NOT_CHECKED',
        summary: `Capability ${rule.capabilityId} is disabled by policy`,
        reasons: [],
        evidenceIds: [],
      });
      continue;
    }

    results.push({
      ruleId: rule.ruleId,
      capabilityId: rule.capabilityId,
      policyMode: policy.mode,
      ...(await rule.evaluate({ ...context, policy })),
    });
  }

  return results;
}

export function createCompatibilityEngine(
  options: CompatibilityEngineOptions,
): CompatibilityEngine {
  assertRuntimeVersions(options.versions);
  assertUniqueIds(
    options.rules.map(({ ruleId }) => ruleId),
    'ruleId',
  );

  const rules = [...options.rules].sort((left, right) =>
    left.ruleId.localeCompare(right.ruleId),
  );
  const versions: EngineVersions = {
    ...clone(options.versions),
    providerVersions: sortProviderVersions(options.versions.providerVersions),
  };
  const clock = options.clock ?? (() => new Date());

  async function run(
    input: CompatibilityCheckInput,
    checkedAt: string,
  ): Promise<ResultSnapshot> {
    assertInput(input);
    const inputSnapshot = clone({
      build: input.build,
      intent: input.intent,
      installationContext: input.installationContext,
      policyProfile: input.policyProfile,
    });
    const evidenceSnapshot: JsonValue = clone(input.evidenceSnapshot);
    const ruleResults = await evaluateRules(rules, inputSnapshot.policyProfile, {
      build: inputSnapshot.build,
      intent: inputSnapshot.intent,
      installationContext: inputSnapshot.installationContext,
    });

    return {
      snapshotFormatVersion: SNAPSHOT_FORMAT_VERSION,
      checkedAt,
      ...versions,
      policyVersion: inputSnapshot.policyProfile.policyVersion,
      inputSnapshot,
      evidenceSnapshot,
      resultSnapshot: aggregateRuleResults(ruleResults),
    };
  }

  return {
    check: (input) => run(input, clock().toISOString()),
    replay: async (snapshot) => {
      assertReplayVersions(snapshot, versions);
      const replayed = await run(
        {
          ...snapshot.inputSnapshot,
          evidenceSnapshot: snapshot.evidenceSnapshot,
        },
        snapshot.checkedAt,
      );
      if (
        JSON.stringify(replayed.resultSnapshot) !==
        JSON.stringify(snapshot.resultSnapshot)
      ) {
        throw new ReplayResultMismatchError();
      }
      return replayed;
    },
  };
}
