import { Value } from '@sinclair/typebox/value';

import { CanonicalBuildSchema, type CanonicalBuild } from './build.js';
import {
  CanonicalPartSchema,
  type CanonicalPart,
} from './canonical/canonical-part.js';
import {
  CANONICAL_SCHEMA_VERSION,
} from './canonical/primitives.js';
import {
  INSTALLATION_CONTEXT_SCHEMA_VERSION,
  InstallationContextSchema,
  type InstallationContext,
} from './installation-context.js';

const LEGACY_CANONICAL_SCHEMA_VERSION = '3.0.0' as const;
const LEGACY_INSTALLATION_CONTEXT_SCHEMA_VERSION = '2.0.0' as const;

function cloneRecord(value: unknown, expectedVersion: string, label: string) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== expectedVersion
  ) {
    throw new Error(`Expected ${label} schema version ${expectedVersion}`);
  }

  return structuredClone(value) as Record<string, unknown>;
}

export function upgradeCanonicalPart3To3_1(
  value: unknown,
): CanonicalPart {
  const upgraded = cloneRecord(
    value,
    LEGACY_CANONICAL_SCHEMA_VERSION,
    'canonical',
  );
  if (
    upgraded.category === 'PSU' &&
    (typeof upgraded.spec !== 'object' ||
      upgraded.spec === null ||
      Array.isArray(upgraded.spec) ||
      !Object.hasOwn(upgraded.spec, 'formFactor'))
  ) {
    throw new Error('Invalid canonical part 3.0.0');
  }
  upgraded.schemaVersion = CANONICAL_SCHEMA_VERSION;

  if (!Value.Check(CanonicalPartSchema, upgraded)) {
    throw new Error('Invalid canonical part 3.0.0');
  }

  return upgraded as CanonicalPart;
}

export function upgradeCanonicalBuild3To3_1(
  value: unknown,
): CanonicalBuild {
  const upgraded = cloneRecord(
    value,
    LEGACY_CANONICAL_SCHEMA_VERSION,
    'canonical',
  );
  if (!Array.isArray(upgraded.parts)) {
    throw new Error('Invalid canonical build 3.0.0');
  }

  upgraded.schemaVersion = CANONICAL_SCHEMA_VERSION;
  upgraded.parts = upgraded.parts.map(upgradeCanonicalPart3To3_1);

  if (!Value.Check(CanonicalBuildSchema, upgraded)) {
    throw new Error('Invalid canonical build 3.0.0');
  }

  return upgraded as CanonicalBuild;
}

export function upgradeInstallationContext2To2_1(
  value: unknown,
): InstallationContext {
  const upgraded = cloneRecord(
    value,
    LEGACY_INSTALLATION_CONTEXT_SCHEMA_VERSION,
    'installation context',
  );
  if (Object.hasOwn(upgraded, 'componentRevisions')) {
    throw new Error('Invalid installation context 2.0.0');
  }
  upgraded.schemaVersion = INSTALLATION_CONTEXT_SCHEMA_VERSION;

  if (!Value.Check(InstallationContextSchema, upgraded)) {
    throw new Error('Invalid installation context 2.0.0');
  }

  return upgraded as InstallationContext;
}
