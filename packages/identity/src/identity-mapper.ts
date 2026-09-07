import type { JsonPrimitive, PartCategory, PartId } from '@pcpartcheck/core';

export const IDENTITY_MAPPER_VERSION = '1.0.0' as const;

export interface PartIdentifiers {
  readonly mpn?: string;
  readonly gtin?: string;
  readonly ean?: string;
  readonly upc?: string;
}

export interface ExternalPartIdentity {
  readonly source: string;
  readonly externalId: string;
  readonly category: PartCategory;
  readonly manufacturer: string;
  readonly model: string;
  readonly rawName?: string;
  readonly identifiers?: PartIdentifiers;
  readonly criticalSpecs?: Readonly<Record<string, JsonPrimitive>>;
}

export interface CanonicalIdentity {
  readonly partId: PartId;
  readonly category: PartCategory;
  readonly manufacturer: string;
  readonly model: string;
  readonly identifiers?: PartIdentifiers;
  readonly criticalSpecs?: Readonly<Record<string, JsonPrimitive>>;
}

export type IdentityMatchMethod =
  | 'EXTERNAL_MAPPING'
  | 'GLOBAL_IDENTIFIER'
  | 'MANUFACTURER_MODEL_SPECS'
  | 'NEW_PART';

export type IdentityConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type ExternalMappingStatus =
  | 'CONFIRMED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED';

export interface ExternalMapping {
  readonly source: string;
  readonly externalId: string;
  readonly partId: PartId;
  readonly rawName: string;
  readonly matchMethod: IdentityMatchMethod;
  readonly confidence: IdentityConfidence;
  readonly status: ExternalMappingStatus;
  readonly matchedAt: string;
  readonly mapperVersion: string;
}

export type IdentityResolutionOutcome =
  | 'MATCHED'
  | 'NEW'
  | 'REVIEW_REQUIRED'
  | 'REJECTED';

export interface IdentityResolution {
  readonly outcome: IdentityResolutionOutcome;
  readonly partId?: PartId;
  readonly matchMethod?: IdentityMatchMethod;
  readonly mapping?: ExternalMapping;
  readonly candidatePartIds: readonly PartId[];
  readonly reasons: readonly string[];
}

export interface ResolveCanonicalIdentityInput {
  readonly incoming: ExternalPartIdentity;
  readonly mappings: readonly ExternalMapping[];
  readonly canonicalIdentities: readonly CanonicalIdentity[];
  readonly createPartId: () => PartId;
  readonly matchedAt: string;
  readonly mapperVersion?: string;
}

const identifierKeys = ['mpn', 'gtin', 'ean', 'upc'] as const;

function compact(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US').replaceAll(/[^\p{L}\p{N}]/gu, '');
}

function normalizeIdentifier(key: (typeof identifierKeys)[number], value: string): string {
  const normalized = value.normalize('NFKC').trim().toLocaleUpperCase('en-US');
  return key === 'mpn' ? normalized.replaceAll(/[^\p{L}\p{N}]/gu, '') : normalized.replaceAll(/\D/gu, '');
}

function sameName(
  incoming: ExternalPartIdentity,
  candidate: CanonicalIdentity,
): boolean {
  return (
    incoming.category === candidate.category &&
    compact(incoming.manufacturer) === compact(candidate.manufacturer) &&
    compact(incoming.model) === compact(candidate.model)
  );
}

function criticalSpecKeys(
  specs: Readonly<Record<string, JsonPrimitive>> | undefined,
): readonly string[] {
  return specs ? Object.keys(specs).sort() : [];
}

function criticalSpecsEqual(
  incoming: Readonly<Record<string, JsonPrimitive>> | undefined,
  candidate: Readonly<Record<string, JsonPrimitive>> | undefined,
): boolean {
  const incomingKeys = criticalSpecKeys(incoming);
  const candidateKeys = criticalSpecKeys(candidate);
  return (
    incomingKeys.length > 0 &&
    incomingKeys.length === candidateKeys.length &&
    incomingKeys.every(
      (key, index) => key === candidateKeys[index] && incoming?.[key] === candidate?.[key],
    )
  );
}

function criticalSpecsConflict(
  incoming: Readonly<Record<string, JsonPrimitive>> | undefined,
  candidate: Readonly<Record<string, JsonPrimitive>> | undefined,
): boolean {
  if (!incoming || !candidate) return false;
  return Object.keys(incoming).some(
    (key) => key in candidate && incoming[key] !== candidate[key],
  );
}

function mappingFor(
  input: ResolveCanonicalIdentityInput,
  partId: PartId,
  matchMethod: IdentityMatchMethod,
): ExternalMapping {
  return {
    source: input.incoming.source,
    externalId: input.incoming.externalId,
    partId,
    rawName:
      input.incoming.rawName ??
      `${input.incoming.manufacturer} ${input.incoming.model}`,
    matchMethod,
    confidence: 'HIGH',
    status: 'CONFIRMED',
    matchedAt: input.matchedAt,
    mapperVersion: input.mapperVersion ?? IDENTITY_MAPPER_VERSION,
  };
}

function matched(
  input: ResolveCanonicalIdentityInput,
  partId: PartId,
  matchMethod: IdentityMatchMethod,
  reason: string,
  existingMapping?: ExternalMapping,
): IdentityResolution {
  return {
    outcome: 'MATCHED',
    partId,
    matchMethod,
    mapping: existingMapping ?? mappingFor(input, partId, matchMethod),
    candidatePartIds: [partId],
    reasons: [reason],
  };
}

export function resolveCanonicalIdentity(
  input: ResolveCanonicalIdentityInput,
): IdentityResolution {
  const existingMapping = input.mappings.find(
    (mapping) =>
      mapping.source === input.incoming.source &&
      mapping.externalId === input.incoming.externalId,
  );
  if (existingMapping) {
    return matched(
      input,
      existingMapping.partId,
      'EXTERNAL_MAPPING',
      'Existing source mapping reused',
      existingMapping,
    );
  }

  const identifierMatches = input.canonicalIdentities.filter((candidate) =>
    identifierKeys.some((key) => {
      const incomingValue = input.incoming.identifiers?.[key];
      const candidateValue = candidate.identifiers?.[key];
      return (
        incomingValue !== undefined &&
        candidateValue !== undefined &&
        normalizeIdentifier(key, incomingValue) === normalizeIdentifier(key, candidateValue)
      );
    }),
  );
  const identifierPartIds = [...new Set(identifierMatches.map((candidate) => candidate.partId))];
  const conflictingIdentifierMatches = identifierMatches.filter((candidate) =>
    criticalSpecsConflict(input.incoming.criticalSpecs, candidate.criticalSpecs),
  );
  if (conflictingIdentifierMatches.length > 0) {
    return {
      outcome: 'REJECTED',
      candidatePartIds: conflictingIdentifierMatches.map(
        (candidate) => candidate.partId,
      ),
      reasons: ['Product identifier matched but a critical specification conflicts'],
    };
  }
  if (identifierPartIds.length === 1) {
    return matched(
      input,
      identifierPartIds[0] as PartId,
      'GLOBAL_IDENTIFIER',
      'Exact normalized product identifier matched',
    );
  }
  if (identifierPartIds.length > 1) {
    return {
      outcome: 'REJECTED',
      candidatePartIds: identifierPartIds,
      reasons: ['Product identifier maps to multiple canonical parts'],
    };
  }

  const nameMatches = input.canonicalIdentities.filter((candidate) =>
    sameName(input.incoming, candidate),
  );
  const conflicting = nameMatches.filter((candidate) =>
    criticalSpecsConflict(input.incoming.criticalSpecs, candidate.criticalSpecs),
  );
  if (conflicting.length > 0) {
    return {
      outcome: 'REJECTED',
      candidatePartIds: conflicting.map((candidate) => candidate.partId),
      reasons: ['Normalized name matched but a critical specification conflicts'],
    };
  }

  const exactSpecMatches = nameMatches.filter((candidate) =>
    criticalSpecsEqual(input.incoming.criticalSpecs, candidate.criticalSpecs),
  );
  if (exactSpecMatches.length === 1) {
    return matched(
      input,
      exactSpecMatches[0]!.partId,
      'MANUFACTURER_MODEL_SPECS',
      'Normalized manufacturer, model, and critical specifications matched',
    );
  }
  if (nameMatches.length > 0) {
    return {
      outcome: 'REVIEW_REQUIRED',
      candidatePartIds: nameMatches.map((candidate) => candidate.partId),
      reasons: ['Name match is not backed by complete matching critical specifications'],
    };
  }

  const similarManufacturerCandidates = input.canonicalIdentities.filter(
    (candidate) =>
      candidate.category === input.incoming.category &&
      compact(candidate.manufacturer) === compact(input.incoming.manufacturer),
  );
  if (similarManufacturerCandidates.length > 0) {
    return {
      outcome: 'REVIEW_REQUIRED',
      candidatePartIds: similarManufacturerCandidates.map((candidate) => candidate.partId),
      reasons: ['Manufacturer and category match, but identity proof is insufficient'],
    };
  }

  const partId = input.createPartId();
  return {
    outcome: 'NEW',
    partId,
    matchMethod: 'NEW_PART',
    mapping: mappingFor(input, partId, 'NEW_PART'),
    candidatePartIds: [],
    reasons: ['No existing mapping or plausible canonical candidate was found'],
  };
}
