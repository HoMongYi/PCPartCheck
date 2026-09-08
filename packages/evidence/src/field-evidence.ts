import {
  CanonicalUnitSchema,
  InstallationContextSchema,
  PartIdSchema,
  type InstallationContext,
  type RuleCondition,
  type RuleEvaluation,
} from '@pcpartcheck/core';
import { Type, type Static } from '@sinclair/typebox';

/*
 * Visibility controls who may read a report. Redaction records whether details
 * were transformed before the record crossed that access boundary.
 */
export const FIELD_EVIDENCE_SCHEMA_VERSION = '2.0.0' as const;

export const FieldEvidenceStatusSchema = Type.Union([
  Type.Literal('DRAFT'),
  Type.Literal('APPROVED'),
  Type.Literal('REJECTED'),
]);
export type FieldEvidenceStatus = Static<typeof FieldEvidenceStatusSchema>;

export const FieldEvidenceVisibilitySchema = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('STAFF_ONLY'),
  Type.Literal('ADMIN_ONLY'),
]);
export type FieldEvidenceVisibility = Static<typeof FieldEvidenceVisibilitySchema>;

export const FieldEvidenceRedactionSchema = Type.Union([
  Type.Literal('NONE'),
  Type.Literal('ANONYMIZED'),
]);
export type FieldEvidenceRedaction = Static<typeof FieldEvidenceRedactionSchema>;

export const FieldEvidenceOutcomeSchema = Type.Union([
  Type.Literal('ASSEMBLY_SUCCESS'),
  Type.Literal('ASSEMBLY_FAILURE'),
]);
export type FieldEvidenceOutcome = Static<typeof FieldEvidenceOutcomeSchema>;

export const FieldEvidenceIssueTypeSchema = Type.Union([
  Type.Literal('PHYSICAL_CLEARANCE'),
  Type.Literal('RADIATOR_CLEARANCE'),
  Type.Literal('MEMORY_CLEARANCE'),
  Type.Literal('POWER_CONNECTOR'),
  Type.Literal('BIOS_POST'),
  Type.Literal('STORAGE_RESOURCE'),
  Type.Literal('THERMAL'),
]);
export type FieldEvidenceIssueType = Static<typeof FieldEvidenceIssueTypeSchema>;

const PartCategorySchema = Type.Union([
  Type.Literal('CPU'),
  Type.Literal('CPU_COOLER'),
  Type.Literal('GPU'),
  Type.Literal('MOTHERBOARD'),
  Type.Literal('PC_CASE'),
  Type.Literal('PSU'),
  Type.Literal('MEMORY'),
  Type.Literal('STORAGE'),
  Type.Literal('CASE_FAN'),
  Type.Literal('PCIE_CARD'),
]);

export const FieldEvidencePartReferenceSchema = Type.Object(
  { category: PartCategorySchema, partId: PartIdSchema },
  { additionalProperties: false },
);

export const FieldMeasurementSchema = Type.Object(
  {
    fieldPath: Type.String({ minLength: 1 }),
    value: Type.Union([Type.Null(), Type.Boolean(), Type.Number(), Type.String()]),
    unit: Type.Optional(CanonicalUnitSchema),
    rawEvidenceId: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const FieldEvidenceConditionSchema = Type.Object(
  {
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const FieldEvidenceRecordSchema = Type.Object(
  {
    schemaVersion: Type.Literal(FIELD_EVIDENCE_SCHEMA_VERSION),
    evidenceId: Type.String({ minLength: 1 }),
    status: FieldEvidenceStatusSchema,
    visibility: FieldEvidenceVisibilitySchema,
    redaction: FieldEvidenceRedactionSchema,
    outcome: FieldEvidenceOutcomeSchema,
    issueType: FieldEvidenceIssueTypeSchema,
    parts: Type.Array(FieldEvidencePartReferenceSchema, { minItems: 1 }),
    installationContext: InstallationContextSchema,
    measurements: Type.Optional(Type.Array(FieldMeasurementSchema)),
    conditions: Type.Optional(Type.Array(FieldEvidenceConditionSchema)),
    reportedAt: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const FieldEvidenceQuerySchema = Type.Object(
  {
    issueType: FieldEvidenceIssueTypeSchema,
    parts: Type.Array(FieldEvidencePartReferenceSchema, { minItems: 1 }),
    installationContext: InstallationContextSchema,
  },
  { additionalProperties: false },
);

export type FieldEvidencePartReference = Static<
  typeof FieldEvidencePartReferenceSchema
>;
export type FieldMeasurement = Static<typeof FieldMeasurementSchema>;
export type FieldEvidenceRecord = Omit<
  Static<typeof FieldEvidenceRecordSchema>,
  'installationContext' | 'parts' | 'measurements' | 'conditions'
> & {
  readonly parts: readonly FieldEvidencePartReference[];
  readonly installationContext: InstallationContext;
  readonly measurements?: readonly FieldMeasurement[];
  readonly conditions?: readonly RuleCondition[];
};
export type FieldEvidenceQuery = Omit<
  Static<typeof FieldEvidenceQuerySchema>,
  'installationContext' | 'parts'
> & {
  readonly parts: readonly FieldEvidencePartReference[];
  readonly installationContext: InstallationContext;
};

export type FieldEvidenceMatch = 'EXACT' | 'SIMILAR' | 'NONE';

function orderedParts(parts: readonly FieldEvidencePartReference[]): readonly string[] {
  return parts
    .map((part) => `${part.category}:${part.partId}`)
    .sort((left, right) => left.localeCompare(right));
}

function orderedInstallationContext(context: InstallationContext): unknown {
  return {
    schemaVersion: context.schemaVersion,
    ...(context.radiators === undefined
      ? {}
      : {
          radiators: [...context.radiators].sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right)),
          ),
        }),
    ...(context.hddCages === undefined
      ? {}
      : {
          hddCages: [...context.hddCages].sort((left, right) =>
            left.cageId.localeCompare(right.cageId),
          ),
        }),
    ...(context.gpuOrientation === undefined
      ? {}
      : { gpuOrientation: context.gpuOrientation }),
    ...(context.occupiedPcieSlotIds === undefined
      ? {}
      : {
          occupiedPcieSlotIds: [...context.occupiedPcieSlotIds].sort(
            (left, right) => left.localeCompare(right),
          ),
        }),
    ...(context.pciePower === undefined
      ? {}
      : {
          pciePower: {
            independentCableCount: context.pciePower.independentCableCount,
            native12VhpwrCableCount: context.pciePower.native12VhpwrCableCount,
            native12V2x6CableCount: context.pciePower.native12V2x6CableCount,
            adapterUsed: context.pciePower.adapterUsed,
          },
        }),
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
