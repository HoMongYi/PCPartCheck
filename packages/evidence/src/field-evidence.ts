import {
  CanonicalUnitSchema,
  ComponentRevisionSchema,
  GpuOrientationSchema,
  InstallationContextSchema,
  InstalledHddCageSchema,
  InstalledRadiatorSchema,
  JsonValueSchema,
  PartIdSchema,
  PciePowerInstallationSchema,
  type InstallationContext,
  type JsonValue,
  type RuleCondition,
  type RuleEvaluation,
} from '@pcpartcheck/core';
import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

import {
  ExactEvidenceScopeSchema,
  assertValidExactEvidenceScope,
  isAutomaticExactIssue,
  type ExactEvidenceScope,
  type MaterialContextField,
} from './evidence-policy.js';
import { FIELD_EVIDENCE_POLICY_VERSION } from './evidence-policy.js';

export const FIELD_EVIDENCE_SCHEMA_VERSION = '4.0.0' as const;
export const LEGACY_FIELD_EVIDENCE_SCHEMA_VERSION = '3.0.0' as const;

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

export const FieldEvidencePartReferenceV3Schema = Type.Object(
  { category: PartCategorySchema, partId: PartIdSchema },
  { additionalProperties: false },
);
export const FieldEvidencePartReferenceSchema = Type.Object(
  {
    category: PartCategorySchema,
    partId: PartIdSchema,
    hardwareRevision: Type.Optional(Type.String({ minLength: 1 })),
  },
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

const LegacyInstallationContextSchema = Type.Object(
  {
    schemaVersion: Type.Literal('2.0.0'),
    radiators: Type.Optional(Type.Array(InstalledRadiatorSchema)),
    hddCages: Type.Optional(Type.Array(InstalledHddCageSchema)),
    gpuOrientation: Type.Optional(GpuOrientationSchema),
    occupiedPcieSlotIds: Type.Optional(
      Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
    ),
    pciePower: Type.Optional(PciePowerInstallationSchema),
    installedBiosVersion: Type.Optional(Type.String({ minLength: 1 })),
    customFacts: Type.Optional(Type.Record(Type.String(), JsonValueSchema)),
  },
  { additionalProperties: false },
);
const HistoricalInstallationContextSchema = Type.Union([
  LegacyInstallationContextSchema,
  InstallationContextSchema,
]);

const installationContextTransportProperties = {
  radiators: Type.Optional(Type.Array(InstalledRadiatorSchema)),
  hddCages: Type.Optional(Type.Array(InstalledHddCageSchema)),
  gpuOrientation: Type.Optional(GpuOrientationSchema),
  occupiedPcieSlotIds: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  ),
  pciePower: Type.Optional(PciePowerInstallationSchema),
  installedBiosVersion: Type.Optional(Type.String({ minLength: 1 })),
  customFacts: Type.Optional(Type.Record(Type.String(), Type.Any())),
} as const;
const HistoricalInstallationContextTransportSchema = Type.Union([
  Type.Object(
    {
      schemaVersion: Type.Literal('2.0.0'),
      ...installationContextTransportProperties,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      schemaVersion: Type.Literal('2.1.0'),
      ...installationContextTransportProperties,
      componentRevisions: Type.Optional(Type.Array(ComponentRevisionSchema)),
    },
    { additionalProperties: false },
  ),
]);
const InstallationContextTransportSchema = Type.Object(
  {
    schemaVersion: Type.Literal('2.1.0'),
    ...installationContextTransportProperties,
    componentRevisions: Type.Optional(Type.Array(ComponentRevisionSchema)),
  },
  { additionalProperties: false },
);

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

const commonProperties = {
  evidenceId: Type.String({ minLength: 1 }),
  status: FieldEvidenceStatusSchema,
  visibility: FieldEvidenceVisibilitySchema,
  redaction: FieldEvidenceRedactionSchema,
  outcome: FieldEvidenceOutcomeSchema,
  issueType: FieldEvidenceIssueTypeSchema,
  measurements: Type.Optional(Type.Array(FieldMeasurementSchema)),
  conditions: Type.Optional(Type.Array(FieldEvidenceConditionSchema, { minItems: 1 })),
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

const FieldEvidenceRecordV3BaseSchema = Type.Object(
  {
    schemaVersion: Type.Literal(LEGACY_FIELD_EVIDENCE_SCHEMA_VERSION),
    ...commonProperties,
    parts: Type.Array(FieldEvidencePartReferenceV3Schema, { minItems: 1 }),
    installationContext: HistoricalInstallationContextSchema,
  },
  { additionalProperties: false },
);

const FieldEvidenceRecordV4BaseSchema = Type.Object(
  {
    schemaVersion: Type.Literal(FIELD_EVIDENCE_SCHEMA_VERSION),
    ...commonProperties,
    parts: Type.Array(FieldEvidencePartReferenceSchema, { minItems: 1 }),
    exactScope: ExactEvidenceScopeSchema,
    installationContext: InstallationContextSchema,
  },
  { additionalProperties: false },
);

export const FieldEvidenceRecordV3Schema = Type.Intersect([
  FieldEvidenceRecordV3BaseSchema,
  FieldEvidenceOutcomeConstraintSchema,
  FieldEvidenceStateConstraintSchema,
]);
export const FieldEvidenceRecordV4Schema = Type.Intersect([
  FieldEvidenceRecordV4BaseSchema,
  FieldEvidenceOutcomeConstraintSchema,
  FieldEvidenceStateConstraintSchema,
]);
export const FieldEvidenceRecordSchema = Type.Union([
  FieldEvidenceRecordV3Schema,
  FieldEvidenceRecordV4Schema,
]);
export const FieldEvidenceRecordTransportSchema = Type.Union([
  Type.Object(
    {
      schemaVersion: Type.Literal(LEGACY_FIELD_EVIDENCE_SCHEMA_VERSION),
      ...commonProperties,
      parts: Type.Array(FieldEvidencePartReferenceV3Schema, { minItems: 1 }),
      installationContext: HistoricalInstallationContextTransportSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      schemaVersion: Type.Literal(FIELD_EVIDENCE_SCHEMA_VERSION),
      ...commonProperties,
      parts: Type.Array(FieldEvidencePartReferenceSchema, { minItems: 1 }),
      exactScope: ExactEvidenceScopeSchema,
      installationContext: InstallationContextTransportSchema,
    },
    { additionalProperties: false },
  ),
]);

const draftProperties = {
  evidenceId: commonProperties.evidenceId,
  visibility: commonProperties.visibility,
  redaction: commonProperties.redaction,
  outcome: commonProperties.outcome,
  issueType: commonProperties.issueType,
  parts: Type.Array(FieldEvidencePartReferenceSchema, { minItems: 1 }),
  exactScope: ExactEvidenceScopeSchema,
  installationContext: InstallationContextSchema,
  measurements: commonProperties.measurements,
  conditions: commonProperties.conditions,
  attachments: commonProperties.attachments,
  reportedAt: commonProperties.reportedAt,
  supersedesEvidenceId: commonProperties.supersedesEvidenceId,
} as const;

export const FieldEvidenceDraftInputSchema = Type.Intersect([
  Type.Object(draftProperties, { additionalProperties: false }),
  FieldEvidenceOutcomeConstraintSchema,
]);

export const FieldEvidencePatchSchema = Type.Object(
  {
    visibility: Type.Optional(FieldEvidenceVisibilitySchema),
    redaction: Type.Optional(FieldEvidenceRedactionSchema),
    outcome: Type.Optional(FieldEvidenceOutcomeSchema),
    issueType: Type.Optional(FieldEvidenceIssueTypeSchema),
    parts: Type.Optional(Type.Array(FieldEvidencePartReferenceSchema, { minItems: 1 })),
    exactScope: Type.Optional(ExactEvidenceScopeSchema),
    installationContext: Type.Optional(InstallationContextSchema),
    measurements: Type.Optional(Type.Array(FieldMeasurementSchema)),
    conditions: Type.Optional(Type.Array(FieldEvidenceConditionSchema, { minItems: 1 })),
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

export const FieldEvidenceSnapshotSchema = Type.Object(
  {
    fieldEvidenceSchemaVersion: Type.Literal(FIELD_EVIDENCE_SCHEMA_VERSION),
    evidencePolicyVersion: Type.Literal(FIELD_EVIDENCE_POLICY_VERSION),
    records: Type.Array(FieldEvidenceRecordV4Schema),
  },
  { additionalProperties: false },
);

export type FieldEvidencePartReferenceV3 = Static<
  typeof FieldEvidencePartReferenceV3Schema
>;
export type FieldEvidencePartReference = Static<
  typeof FieldEvidencePartReferenceSchema
>;
export type FieldMeasurement = Static<typeof FieldMeasurementSchema>;
export type FieldEvidenceDraftInput = Static<typeof FieldEvidenceDraftInputSchema>;
export type FieldEvidencePatch = Static<typeof FieldEvidencePatchSchema>;
type FieldEvidenceRecordV3Value = Static<typeof FieldEvidenceRecordV3Schema>;
type FieldEvidenceRecordV4Value = Static<typeof FieldEvidenceRecordV4Schema>;
type LegacyInstallationContextValue = Static<typeof LegacyInstallationContextSchema>;
export type LegacyInstallationContext = Omit<
  LegacyInstallationContextValue,
  'customFacts'
> & {
  readonly customFacts?: Readonly<Record<string, JsonValue>>;
};
export type FieldEvidenceRecordV3 = Omit<
  FieldEvidenceRecordV3Value,
  'installationContext' | 'parts' | 'measurements' | 'conditions' | 'attachments'
> & {
  readonly parts: readonly FieldEvidencePartReferenceV3[];
  readonly installationContext: InstallationContext | LegacyInstallationContext;
  readonly measurements?: readonly FieldMeasurement[];
  readonly conditions?: readonly RuleCondition[];
  readonly attachments?: readonly AttachmentReference[];
};
export type FieldEvidenceRecordV4 = Omit<
  FieldEvidenceRecordV4Value,
  'installationContext' | 'parts' | 'measurements' | 'conditions' | 'attachments'
> & {
  readonly parts: readonly FieldEvidencePartReference[];
  readonly exactScope: ExactEvidenceScope;
  readonly installationContext: InstallationContext;
  readonly measurements?: readonly FieldMeasurement[];
  readonly conditions?: readonly RuleCondition[];
  readonly attachments?: readonly AttachmentReference[];
};
export type FieldEvidenceRecord = FieldEvidenceRecordV3 | FieldEvidenceRecordV4;
export type FieldEvidenceQuery = Omit<
  Static<typeof FieldEvidenceQuerySchema>,
  'installationContext' | 'parts'
> & {
  readonly parts: readonly FieldEvidencePartReference[];
  readonly installationContext: InstallationContext;
};
export interface FieldEvidenceSnapshot {
  readonly fieldEvidenceSchemaVersion: typeof FIELD_EVIDENCE_SCHEMA_VERSION;
  readonly evidencePolicyVersion: typeof FIELD_EVIDENCE_POLICY_VERSION;
  readonly records: readonly FieldEvidenceRecordV4[];
}

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

export class InvalidFieldEvidenceSnapshotError extends Error {
  readonly code = 'INVALID_FIELD_EVIDENCE_SNAPSHOT';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidFieldEvidenceSnapshotError';
  }
}

function assertSchema(schema: TSchema, value: unknown): void {
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
): FieldEvidenceRecordV4 {
  assertSchema(FieldEvidenceDraftInputSchema, input);
  const record = {
    ...cloneJsonValue(input),
    schemaVersion: FIELD_EVIDENCE_SCHEMA_VERSION,
    status: 'DRAFT' as const,
    createdByPrincipalId: audit.principalId,
    createdAt: audit.at,
    updatedAt: audit.at,
  };
  assertSchema(FieldEvidenceRecordV4Schema, record);
  return record as FieldEvidenceRecordV4;
}

export function patchDraftFieldEvidence(
  record: FieldEvidenceRecord,
  patch: FieldEvidencePatch,
  audit: FieldEvidenceMutationAudit,
): FieldEvidenceRecordV4 {
  if (record.status !== 'DRAFT') {
    throw new FieldEvidenceStateConflictError('Only DRAFT field evidence can be changed');
  }
  if (record.schemaVersion !== FIELD_EVIDENCE_SCHEMA_VERSION) {
    throw new FieldEvidenceStateConflictError('Historical field evidence is read-only');
  }
  assertSchema(FieldEvidencePatchSchema, patch);
  const updated = { ...record, ...cloneJsonValue(patch), updatedAt: audit.at };
  assertSchema(FieldEvidenceRecordV4Schema, updated);
  return updated as FieldEvidenceRecordV4;
}

export function moderateFieldEvidence(
  record: FieldEvidenceRecord,
  moderation: FieldEvidenceModeration,
): FieldEvidenceRecordV4 {
  if (record.status !== 'DRAFT') {
    throw new FieldEvidenceStateConflictError('Only DRAFT field evidence can be moderated');
  }
  if (record.schemaVersion !== FIELD_EVIDENCE_SCHEMA_VERSION) {
    throw new FieldEvidenceStateConflictError('Historical field evidence is read-only');
  }
  if (moderation.action === 'APPROVE') {
    assertValidExactEvidenceScope(record.issueType, record.parts, record.exactScope);
  }
  const moderated = {
    ...record,
    status: moderation.action === 'APPROVE' ? 'APPROVED' as const : 'REJECTED' as const,
    updatedAt: moderation.at,
    moderatedByPrincipalId: moderation.principalId,
    moderatedAt: moderation.at,
    ...(moderation.reason === undefined ? {} : { moderationReason: moderation.reason }),
  };
  assertSchema(FieldEvidenceRecordV4Schema, moderated);
  return moderated as FieldEvidenceRecordV4;
}

function orderedPartIdentities(
  parts: readonly { readonly category: string; readonly partId: string }[],
): readonly string[] {
  return parts
    .map((part) => `${part.category}:${part.partId}`)
    .sort((left, right) => left.localeCompare(right));
}

function samePartIdentities(
  left: readonly { readonly category: string; readonly partId: string }[],
  right: readonly { readonly category: string; readonly partId: string }[],
): boolean {
  return JSON.stringify(orderedPartIdentities(left)) ===
    JSON.stringify(orderedPartIdentities(right));
}

function orderedJson(value: readonly unknown[]): string {
  return JSON.stringify(
    [...value].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
  );
}

function sameContextField(
  field: MaterialContextField,
  left: InstallationContext,
  right: InstallationContext,
  parts: readonly FieldEvidencePartReference[],
): boolean {
  const leftValue = left[field];
  const rightValue = right[field];
  if (leftValue === undefined || rightValue === undefined) return false;

  if (field === 'componentRevisions') {
    const leftByPart = new Map(left.componentRevisions?.map((revision) => [revision.partId, revision]));
    const rightByPart = new Map(right.componentRevisions?.map((revision) => [revision.partId, revision]));
    return parts.every((part) => {
      const evidenceRevision = part.hardwareRevision;
      const recordedRevision = leftByPart.get(part.partId)?.hardwareRevision;
      const selectedRevision = rightByPart.get(part.partId)?.hardwareRevision;
      return evidenceRevision !== undefined &&
        recordedRevision === evidenceRevision &&
        selectedRevision === evidenceRevision;
    });
  }

  if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
    return orderedJson(leftValue) === orderedJson(rightValue);
  }
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

export function classifyFieldEvidenceMatch(
  record: FieldEvidenceRecord,
  query: FieldEvidenceQuery,
): FieldEvidenceMatch {
  if (record.issueType !== query.issueType) return 'NONE';
  if (record.schemaVersion !== FIELD_EVIDENCE_SCHEMA_VERSION) return 'SIMILAR';

  assertValidExactEvidenceScope(record.issueType, record.parts, record.exactScope);
  if (!isAutomaticExactIssue(record.issueType)) return 'SIMILAR';
  if (!samePartIdentities(record.parts, query.parts)) return 'SIMILAR';

  for (const field of record.exactScope.requiredContextFields) {
    if (!sameContextField(
      field,
      record.installationContext,
      query.installationContext,
      record.parts,
    )) {
      return 'SIMILAR';
    }
  }
  return 'EXACT';
}

function orderedInstallationContext(context: InstallationContext): InstallationContext {
  return {
    ...cloneJsonValue(context),
    ...(context.radiators === undefined
      ? {}
      : { radiators: [...context.radiators].sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right))) }),
    ...(context.hddCages === undefined
      ? {}
      : { hddCages: [...context.hddCages].sort((left, right) =>
          left.cageId.localeCompare(right.cageId)) }),
    ...(context.occupiedPcieSlotIds === undefined
      ? {}
      : { occupiedPcieSlotIds: [...context.occupiedPcieSlotIds].sort() }),
    ...(context.componentRevisions === undefined
      ? {}
      : { componentRevisions: [...context.componentRevisions].sort((left, right) =>
          left.partId.localeCompare(right.partId) ||
          left.hardwareRevision.localeCompare(right.hardwareRevision)) }),
  };
}

function canonicalizeRecord(record: FieldEvidenceRecordV4): FieldEvidenceRecordV4 {
  return {
    ...cloneJsonValue(record),
    parts: [...record.parts]
      .map(cloneJsonValue)
      .sort((left, right) =>
        left.category.localeCompare(right.category) ||
        left.partId.localeCompare(right.partId) ||
        (left.hardwareRevision ?? '').localeCompare(right.hardwareRevision ?? '')),
    exactScope: {
      requiredPartCategories: [...record.exactScope.requiredPartCategories].sort(),
      requiredContextFields: [...record.exactScope.requiredContextFields].sort(),
    },
    installationContext: orderedInstallationContext(record.installationContext),
  };
}

function assertSupersessionGraph(records: readonly FieldEvidenceRecordV4[]): void {
  const byId = new Map<string, FieldEvidenceRecordV4>();
  for (const record of records) {
    if (byId.has(record.evidenceId)) {
      throw new InvalidFieldEvidenceSnapshotError(
        `Duplicate evidenceId: ${record.evidenceId}`,
      );
    }
    byId.set(record.evidenceId, record);
  }

  for (const record of records) {
    const parentId = record.supersedesEvidenceId;
    if (parentId === undefined) continue;
    if (parentId === record.evidenceId) {
      throw new InvalidFieldEvidenceSnapshotError(
        `Evidence cannot supersede itself: ${record.evidenceId}`,
      );
    }
    if (!byId.has(parentId)) {
      throw new InvalidFieldEvidenceSnapshotError(
        `Dangling supersedesEvidenceId: ${parentId}`,
      );
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (record: FieldEvidenceRecordV4): void => {
    if (visited.has(record.evidenceId)) return;
    if (visiting.has(record.evidenceId)) {
      throw new InvalidFieldEvidenceSnapshotError(
        `Supersession cycle includes: ${record.evidenceId}`,
      );
    }
    visiting.add(record.evidenceId);
    const parent = record.supersedesEvidenceId === undefined
      ? undefined
      : byId.get(record.supersedesEvidenceId);
    if (parent !== undefined) visit(parent);
    visiting.delete(record.evidenceId);
    visited.add(record.evidenceId);
  };
  records.forEach(visit);
}

export function validateAndCanonicalizeFieldEvidenceSnapshot(
  snapshot: FieldEvidenceSnapshot,
): FieldEvidenceSnapshot {
  assertSchema(FieldEvidenceSnapshotSchema, snapshot);
  assertSupersessionGraph(snapshot.records);
  for (const record of snapshot.records) {
    if (record.status === 'APPROVED') {
      assertValidExactEvidenceScope(record.issueType, record.parts, record.exactScope);
    }
  }
  return {
    fieldEvidenceSchemaVersion: FIELD_EVIDENCE_SCHEMA_VERSION,
    evidencePolicyVersion: FIELD_EVIDENCE_POLICY_VERSION,
    records: snapshot.records
      .map(canonicalizeRecord)
      .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
  };
}

export interface FieldEvidenceSupersessionConflict {
  readonly supersededEvidenceId: string;
  readonly successorEvidenceIds: readonly string[];
}

export interface ActiveFieldEvidenceSelection {
  readonly activeEvidenceIds: readonly string[];
  readonly active: readonly FieldEvidenceRecordV4[];
  readonly conflicts: readonly FieldEvidenceSupersessionConflict[];
}

export function selectActiveFieldEvidence(
  snapshot: FieldEvidenceSnapshot,
): ActiveFieldEvidenceSelection {
  const canonical = validateAndCanonicalizeFieldEvidenceSnapshot(snapshot);
  const approved = canonical.records.filter((record) => record.status === 'APPROVED');
  const successors = new Map<string, FieldEvidenceRecordV4[]>();
  for (const record of approved) {
    if (record.supersedesEvidenceId === undefined) continue;
    const existing = successors.get(record.supersedesEvidenceId) ?? [];
    existing.push(record);
    successors.set(record.supersedesEvidenceId, existing);
  }

  const active = approved
    .filter((record) => !successors.has(record.evidenceId))
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const conflicts = [...successors.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([supersededEvidenceId, records]) => ({
      supersededEvidenceId,
      successorEvidenceIds: records
        .map(({ evidenceId }) => evidenceId)
        .sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) =>
      left.supersededEvidenceId.localeCompare(right.supersededEvidenceId));

  return {
    activeEvidenceIds: active.map(({ evidenceId }) => evidenceId),
    active,
    conflicts,
  };
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

  const successes = exact.filter((record) => record.outcome === 'ASSEMBLY_SUCCESS');
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
