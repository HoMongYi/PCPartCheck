import {
  CanonicalUnitSchema,
  InstallationContextSchema,
  PartIdSchema,
  type InstallationContext,
  type RuleCondition,
  type RuleEvaluation,
} from '@pcpartcheck/core';
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

/*
 * Visibility controls who may read a report. Redaction records whether details
 * were transformed before the record crossed that access boundary.
 */
export const FIELD_EVIDENCE_SCHEMA_VERSION = '3.0.0' as const;

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
  Type.Literal('CONDITIONAL_SUCCESS'),
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

export const AttachmentReferenceSchema = Type.Object(
  {
    attachmentId: Type.String({ minLength: 1 }),
    mediaType: Type.String({ pattern: '^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*$' }),
    checksum: Type.String({ pattern: '^sha256:[a-f0-9]{64}$' }),
    sizeBytes: Type.Optional(Type.Integer({ minimum: 0 })),
    storageKey: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String({ minLength: 1 })),
    capturedAt: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);
export type AttachmentReference = Static<typeof AttachmentReferenceSchema>;

const FieldEvidenceBaseProperties = {
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
    conditions: Type.Optional(
      Type.Array(FieldEvidenceConditionSchema, { minItems: 1 }),
    ),
    attachments: Type.Optional(Type.Array(AttachmentReferenceSchema)),
    reportedAt: Type.String({ minLength: 1 }),
    createdByPrincipalId: Type.String({ minLength: 1 }),
    createdAt: Type.String({ minLength: 1 }),
    updatedAt: Type.String({ minLength: 1 }),
    moderatedByPrincipalId: Type.Optional(Type.String({ minLength: 1 })),
    moderatedAt: Type.Optional(Type.String({ minLength: 1 })),
    moderationReason: Type.Optional(Type.String({ minLength: 1 })),
    supersedesEvidenceId: Type.Optional(Type.String({ minLength: 1 })),
} as const;

const FieldEvidenceRecordBaseSchema = Type.Object(FieldEvidenceBaseProperties, {
  additionalProperties: false,
});
export const FieldEvidenceRecordTransportSchema = FieldEvidenceRecordBaseSchema;

const FieldEvidenceOutcomeConstraintSchema = Type.Union([
  Type.Intersect([
    Type.Object({ outcome: Type.Literal('ASSEMBLY_SUCCESS') }),
    Type.Not(Type.Object({ conditions: Type.Unknown() })),
  ]),
  Type.Intersect([
    Type.Object({ outcome: Type.Literal('ASSEMBLY_FAILURE') }),
    Type.Not(Type.Object({ conditions: Type.Unknown() })),
  ]),
  Type.Object({
    outcome: Type.Literal('CONDITIONAL_SUCCESS'),
    conditions: Type.Array(FieldEvidenceConditionSchema, { minItems: 1 }),
  }),
]);

const FieldEvidenceStateConstraintSchema = Type.Union([
  Type.Intersect([
    Type.Object({ status: Type.Literal('DRAFT') }),
    Type.Not(
      Type.Union([
        Type.Object({ moderatedByPrincipalId: Type.Unknown() }),
        Type.Object({ moderatedAt: Type.Unknown() }),
        Type.Object({ moderationReason: Type.Unknown() }),
      ]),
    ),
  ]),
  Type.Object({
    status: Type.Union([Type.Literal('APPROVED'), Type.Literal('REJECTED')]),
    moderatedByPrincipalId: Type.String({ minLength: 1 }),
    moderatedAt: Type.String({ minLength: 1 }),
  }),
]);

export const FieldEvidenceRecordSchema = Type.Intersect([
  FieldEvidenceRecordBaseSchema,
  FieldEvidenceOutcomeConstraintSchema,
  FieldEvidenceStateConstraintSchema,
]);

const FieldEvidenceDraftBaseProperties = {
  evidenceId: FieldEvidenceBaseProperties.evidenceId,
  visibility: FieldEvidenceBaseProperties.visibility,
  redaction: FieldEvidenceBaseProperties.redaction,
  outcome: FieldEvidenceBaseProperties.outcome,
  issueType: FieldEvidenceBaseProperties.issueType,
  parts: FieldEvidenceBaseProperties.parts,
  installationContext: FieldEvidenceBaseProperties.installationContext,
  measurements: FieldEvidenceBaseProperties.measurements,
  conditions: FieldEvidenceBaseProperties.conditions,
  attachments: FieldEvidenceBaseProperties.attachments,
  reportedAt: FieldEvidenceBaseProperties.reportedAt,
  supersedesEvidenceId: FieldEvidenceBaseProperties.supersedesEvidenceId,
} as const;

const FieldEvidenceDraftInputBaseSchema = Type.Object(
  FieldEvidenceDraftBaseProperties,
  { additionalProperties: false },
);

export const FieldEvidenceDraftInputSchema = Type.Intersect([
  FieldEvidenceDraftInputBaseSchema,
  FieldEvidenceOutcomeConstraintSchema,
]);

export const FieldEvidencePatchSchema = Type.Object(
  {
    visibility: Type.Optional(FieldEvidenceVisibilitySchema),
    redaction: Type.Optional(FieldEvidenceRedactionSchema),
    outcome: Type.Optional(FieldEvidenceOutcomeSchema),
    issueType: Type.Optional(FieldEvidenceIssueTypeSchema),
    parts: Type.Optional(
      Type.Array(FieldEvidencePartReferenceSchema, { minItems: 1 }),
    ),
    installationContext: Type.Optional(InstallationContextSchema),
    measurements: Type.Optional(Type.Array(FieldMeasurementSchema)),
    conditions: Type.Optional(
      Type.Array(FieldEvidenceConditionSchema, { minItems: 1 }),
    ),
    attachments: Type.Optional(Type.Array(AttachmentReferenceSchema)),
  },
  { additionalProperties: false, minProperties: 1 },
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
export type FieldEvidenceDraftInput = Static<typeof FieldEvidenceDraftInputSchema>;
export type FieldEvidencePatch = Static<typeof FieldEvidencePatchSchema>;
export type FieldEvidenceRecord = Omit<
  Static<typeof FieldEvidenceRecordSchema>,
  'installationContext' | 'parts' | 'measurements' | 'conditions' | 'attachments'
> & {
  readonly parts: readonly FieldEvidencePartReference[];
  readonly installationContext: InstallationContext;
  readonly measurements?: readonly FieldMeasurement[];
  readonly conditions?: readonly RuleCondition[];
  readonly attachments?: readonly AttachmentReference[];
};
export type FieldEvidenceQuery = Omit<
  Static<typeof FieldEvidenceQuerySchema>,
  'installationContext' | 'parts'
> & {
  readonly parts: readonly FieldEvidencePartReference[];
  readonly installationContext: InstallationContext;
};

export type FieldEvidenceMatch = 'EXACT' | 'SIMILAR' | 'NONE';

export interface FieldEvidenceMutationAudit {
  readonly principalId: string;
  readonly at: string;
}

export interface FieldEvidenceModeration extends FieldEvidenceMutationAudit {
  readonly action: 'APPROVE' | 'REJECT';
  readonly reason?: string;
}

export class FieldEvidenceStateConflictError extends Error {
  readonly code = 'FIELD_EVIDENCE_STATE_CONFLICT';

  constructor(message: string) {
    super(message);
    this.name = 'FieldEvidenceStateConflictError';
  }
}

function assertSchema(schema: Parameters<typeof Value.Check>[0], value: unknown): void {
  if (!Value.Check(schema, value)) {
    throw new TypeError('Field evidence does not match its public schema');
  }
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDraftFieldEvidence(
  input: FieldEvidenceDraftInput,
  audit: FieldEvidenceMutationAudit,
): FieldEvidenceRecord {
  assertSchema(FieldEvidenceDraftInputSchema, input);
  const record = {
    ...cloneJsonValue(input),
    schemaVersion: FIELD_EVIDENCE_SCHEMA_VERSION,
    status: 'DRAFT' as const,
    createdByPrincipalId: audit.principalId,
    createdAt: audit.at,
    updatedAt: audit.at,
  };
  assertSchema(FieldEvidenceRecordSchema, record);
  return record as FieldEvidenceRecord;
}

export function patchDraftFieldEvidence(
  record: FieldEvidenceRecord,
  patch: FieldEvidencePatch,
  audit: FieldEvidenceMutationAudit,
): FieldEvidenceRecord {
  if (record.status !== 'DRAFT') {
    throw new FieldEvidenceStateConflictError(
      'Only DRAFT field evidence can be changed',
    );
  }
  assertSchema(FieldEvidencePatchSchema, patch);
  const updated = {
    ...record,
    ...cloneJsonValue(patch),
    updatedAt: audit.at,
  };
  assertSchema(FieldEvidenceRecordSchema, updated);
  return updated as FieldEvidenceRecord;
}

export function moderateFieldEvidence(
  record: FieldEvidenceRecord,
  moderation: FieldEvidenceModeration,
): FieldEvidenceRecord {
  if (record.status !== 'DRAFT') {
    throw new FieldEvidenceStateConflictError(
      'Only DRAFT field evidence can be moderated',
    );
  }
  const moderated = {
    ...record,
    status: moderation.action === 'APPROVE' ? 'APPROVED' as const : 'REJECTED' as const,
    updatedAt: moderation.at,
    moderatedByPrincipalId: moderation.principalId,
    moderatedAt: moderation.at,
    ...(moderation.reason === undefined
      ? {}
      : { moderationReason: moderation.reason }),
  };
  assertSchema(FieldEvidenceRecordSchema, moderated);
  return moderated as FieldEvidenceRecord;
}

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

  const conditionalSuccesses = exact.filter(
    (record) => record.outcome === 'CONDITIONAL_SUCCESS',
  );
  if (conditionalSuccesses.length > 0) {
    return {
      status: 'CONDITIONAL',
      summary: 'Approved exact field evidence requires installation conditions',
      reasons: conditionalSuccesses.map(
        (record) => `Exact field evidence ${record.evidenceId} records a conditional resolution`,
      ),
      conditions: conditionalSuccesses.flatMap((record) => record.conditions ?? []),
      evidenceIds: conditionalSuccesses.map((record) => record.evidenceId),
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
