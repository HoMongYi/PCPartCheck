import { Type, type Static } from '@sinclair/typebox';

import type { JsonValue } from './canonical/primitives.js';

export const CapabilityModeSchema = Type.Union([
  Type.Literal('REQUIRED'),
  Type.Literal('ADVISORY'),
  Type.Literal('DISABLED'),
]);
export type CapabilityMode = Static<typeof CapabilityModeSchema>;

export const CapabilityPolicySchema = Type.Object(
  {
    capabilityId: Type.String({ minLength: 1 }),
    mode: CapabilityModeSchema,
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);

export interface CapabilityPolicy {
  readonly capabilityId: string;
  readonly mode: CapabilityMode;
  readonly config?: Readonly<Record<string, JsonValue>>;
}

export interface PolicyProfile {
  readonly profileId: string;
  readonly policyVersion: string;
  readonly capabilities: readonly CapabilityPolicy[];
}

export interface CapabilityDefinition {
  readonly capabilityId: string;
  readonly title: string;
  readonly description?: string;
}

export interface CapabilityRegistry {
  readonly definitions: readonly CapabilityDefinition[];
  get(capabilityId: string): CapabilityDefinition | undefined;
}

export function createCapabilityRegistry(
  definitions: readonly CapabilityDefinition[],
): CapabilityRegistry {
  const byId = new Map<string, CapabilityDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.capabilityId)) {
      throw new Error(`Duplicate capabilityId: ${definition.capabilityId}`);
    }
    byId.set(definition.capabilityId, definition);
  }

  return {
    definitions: [...definitions],
    get: (capabilityId) => byId.get(capabilityId),
  };
}

export function resolveCapabilityPolicy(
  profile: PolicyProfile,
  capabilityId: string,
): CapabilityPolicy {
  return (
    profile.capabilities.find(
      (capability) => capability.capabilityId === capabilityId,
    ) ?? { capabilityId, mode: 'DISABLED' }
  );
}
