import type {
  CanonicalUnit,
  InstallationContext,
  JsonPrimitive,
  PartCategory,
  PartId,
  RuleCondition,
  RuleEvaluation,
} from '@pcpartcheck/core';

export const FIELD_EVIDENCE_SCHEMA_VERSION = '1.0.0' as const;

export type FieldEvidenceStatus = 'DRAFT' | 'APPROVED' | 'REJECTED';
export type FieldEvidenceVisibility = 'PUBLIC' | 'PRIVATE' | 'ANONYMIZED';
export type FieldEvidenceOutcome = 'ASSEMBLY_SUCCESS' | 'ASSEMBLY_FAILURE';
export type FieldEvidenceIssueType =
  | 'PHYSICAL_CLEARANCE'
  | 'RADIATOR_CLEARANCE'
  | 'MEMORY_CLEARANCE'
  | 'POWER_CONNECTOR'
  | 'BIOS_POST'
  | 'STORAGE_RESOURCE'
  | 'THERMAL';

export interface FieldEvidencePartReference {
  readonly category: PartCategory;
  readonly partId: PartId;
}

export interface FieldMeasurement {
  readonly fieldPath: string;
  readonly value: JsonPrimitive;
  readonly unit?: CanonicalUnit;
  readonly rawEvidenceId?: string;
}

export interface FieldEvidenceRecord {
  readonly schemaVersion: typeof FIELD_EVIDENCE_SCHEMA_VERSION;
  readonly evidenceId: string;
  readonly status: FieldEvidenceStatus;
  readonly visibility: FieldEvidenceVisibility;
  readonly outcome: FieldEvidenceOutcome;
  readonly issueType: FieldEvidenceIssueType;
  readonly parts: readonly FieldEvidencePartReference[];
  readonly installationContext: InstallationContext;
  readonly measurements?: readonly FieldMeasurement[];
  readonly conditions?: readonly RuleCondition[];
  readonly reportedAt: string;
}

export interface FieldEvidenceQuery {
  readonly issueType: FieldEvidenceIssueType;
  readonly parts: readonly FieldEvidencePartReference[];
  readonly installationContext: InstallationContext;
}

export type FieldEvidenceMatch = 'EXACT' | 'SIMILAR' | 'NONE';

function orderedParts(parts: readonly FieldEvidencePartReference[]): readonly string[] {
  return parts
    .map((part) => `${part.category}:${part.partId}`)
    .sort((left, right) => left.localeCompare(right));
}

function orderedInstallationContext(context: InstallationContext): unknown {
  return {
    schemaVersion: context.schemaVersion,
    radiators: [...context.radiators].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
    hddCages: [...context.hddCages].sort((left, right) =>
      left.cageId.localeCompare(right.cageId),
    ),
    gpuOrientation: context.gpuOrientation,
    occupiedPcieSlotIds: [...context.occupiedPcieSlotIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    pciePower: {
      independentCableCount: context.pciePower.independentCableCount,
      native12VhpwrCableCount: context.pciePower.native12VhpwrCableCount,
      native12V2x6CableCount: context.pciePower.native12V2x6CableCount,
      adapterUsed: context.pciePower.adapterUsed,
    },
    installedBiosVersion: context.installedBiosVersion ?? null,
  };
}

function sameParts(
  left: readonly FieldEvidencePartReference[],
  right: readonly FieldEvidencePartReference[],
): boolean {
  return JSON.stringify(orderedParts(left)) === JSON.stringify(orderedParts(right));
}

function sameInstallationContext(
  left: InstallationContext,
  right: InstallationContext,
): boolean {
  return (
    JSON.stringify(orderedInstallationContext(left)) ===
    JSON.stringify(orderedInstallationContext(right))
  );
}

export function classifyFieldEvidenceMatch(
  record: FieldEvidenceRecord,
  query: FieldEvidenceQuery,
): FieldEvidenceMatch {
  if (record.issueType !== query.issueType) return 'NONE';
  if (
    sameParts(record.parts, query.parts) &&
    sameInstallationContext(record.installationContext, query.installationContext)
  ) {
    return 'EXACT';
  }
  return 'SIMILAR';
}

function withEvidenceIds(
  evaluation: RuleEvaluation,
  evidenceIds: readonly string[],
): RuleEvaluation {
  return {
    ...evaluation,
    evidenceIds: [...new Set([...evaluation.evidenceIds, ...evidenceIds])],
  };
}

export function applyExactFieldEvidence(
  base: RuleEvaluation,
  records: readonly FieldEvidenceRecord[],
  query: FieldEvidenceQuery,
): RuleEvaluation {
  const exact = records.filter(
    (record) =>
      record.status === 'APPROVED' &&
      classifyFieldEvidenceMatch(record, query) === 'EXACT',
  );
  if (exact.length === 0) return base;
  if (base.status === 'INCOMPATIBLE') return base;

  const hardFailures = exact.filter(
    (record) =>
      record.outcome === 'ASSEMBLY_FAILURE' &&
      (!record.conditions || record.conditions.length === 0),
  );
  if (hardFailures.length > 0) {
    return {
      status: 'INCOMPATIBLE',
      summary: 'Approved exact field evidence records an assembly failure',
      reasons: hardFailures.map(
        (record) => `Exact field evidence ${record.evidenceId} records assembly failure`,
      ),
      evidenceIds: hardFailures.map((record) => record.evidenceId),
    };
  }

  const conditionalFailures = exact.filter(
    (record) =>
      record.outcome === 'ASSEMBLY_FAILURE' &&
      record.conditions !== undefined &&
      record.conditions.length > 0,
  );
  if (conditionalFailures.length > 0) {
    return {
      status: 'CONDITIONAL',
      summary: 'Approved exact field evidence requires installation conditions',
      reasons: conditionalFailures.map(
        (record) => `Exact field evidence ${record.evidenceId} records a conditional resolution`,
      ),
      conditions: conditionalFailures.flatMap((record) => record.conditions ?? []),
      evidenceIds: conditionalFailures.map((record) => record.evidenceId),
    };
  }

  const successes = exact.filter(
    (record) => record.outcome === 'ASSEMBLY_SUCCESS',
  );
  if (successes.length === 0) return base;
  return withEvidenceIds(
    {
      status: 'PASS',
      summary: 'Approved exact field evidence records assembly success',
      reasons: [],
      evidenceIds: [],
    },
    successes.map((record) => record.evidenceId),
  );
}
