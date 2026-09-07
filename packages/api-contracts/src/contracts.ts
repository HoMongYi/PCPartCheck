import { Type, type Static } from '@sinclair/typebox';
import type { CompatibilityCheckInput, ResultSnapshot } from '@pcpartcheck/core';
import {
  BuildIntentSchema,
  CanonicalBuildSchema,
  GpuOrientationSchema,
  InstalledHddCageSchema,
  InstalledRadiatorSchema,
  PciePowerInstallationSchema,
  PolicyProfileSchema,
} from '@pcpartcheck/core';
import type { RankSimilarFieldEvidenceInput, SimilarFieldEvidenceMatch } from '@pcpartcheck/similarity';

export const HealthResponseSchema = Type.Object(
  {
    status: Type.Literal('ok'),
    service: Type.Literal('pcpartcheck'),
    canonicalSchemaVersion: Type.String(),
  },
  { additionalProperties: false },
);
export type HealthResponse = Static<typeof HealthResponseSchema>;

export const ApiInstallationContextSchema = Type.Object(
  {
    schemaVersion: Type.Literal('1.0.0'),
    radiators: Type.Array(InstalledRadiatorSchema),
    hddCages: Type.Array(InstalledHddCageSchema),
    gpuOrientation: GpuOrientationSchema,
    occupiedPcieSlotIds: Type.Array(Type.String()),
    pciePower: PciePowerInstallationSchema,
    installedBiosVersion: Type.Optional(Type.String()),
    customFacts: Type.Optional(Type.Record(Type.String(), Type.Any())),
  },
  { additionalProperties: false },
);

export const CompatibilityCheckRequestSchema = Type.Object(
  {
    build: CanonicalBuildSchema,
    intent: BuildIntentSchema,
    installationContext: ApiInstallationContextSchema,
    policyProfile: PolicyProfileSchema,
    evidenceSnapshot: Type.Any(),
  },
  { additionalProperties: false },
);
export type CompatibilityCheckRequest = CompatibilityCheckInput;

export const ResultSnapshotResponseSchema = Type.Object(
  {
    snapshotFormatVersion: Type.String(),
    checkedAt: Type.String(),
    engineVersion: Type.String(),
    ruleSetVersion: Type.String(),
    policyVersion: Type.String(),
    canonicalSchemaVersion: Type.String(),
    identityMapperVersion: Type.String(),
    providerVersions: Type.Array(Type.Any()),
    inputSnapshot: Type.Any(),
    evidenceSnapshot: Type.Any(),
    resultSnapshot: Type.Any(),
  },
  { additionalProperties: false },
);

const FieldEvidenceIssueTypeSchema = Type.Union([
  Type.Literal('PHYSICAL_CLEARANCE'),
  Type.Literal('RADIATOR_CLEARANCE'),
  Type.Literal('MEMORY_CLEARANCE'),
  Type.Literal('POWER_CONNECTOR'),
  Type.Literal('BIOS_POST'),
  Type.Literal('STORAGE_RESOURCE'),
  Type.Literal('THERMAL'),
]);

const FieldEvidencePartReferenceSchema = Type.Object(
  {
    category: Type.String(),
    partId: Type.String(),
  },
  { additionalProperties: false },
);

const FieldMeasurementSchema = Type.Object(
  {
    fieldPath: Type.String({ minLength: 1 }),
    value: Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]),
    unit: Type.Optional(Type.String()),
    rawEvidenceId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const SimilarEvidenceRequestSchema = Type.Object(
  {
    issueType: FieldEvidenceIssueTypeSchema,
    parts: Type.Array(FieldEvidencePartReferenceSchema),
    installationContext: ApiInstallationContextSchema,
    measurements: Type.Optional(Type.Array(FieldMeasurementSchema)),
    records: Type.Array(Type.Any()),
  },
  { additionalProperties: false },
);
export type SimilarEvidenceRequest = RankSimilarFieldEvidenceInput;

export const SimilarEvidenceResponseItemSchema = Type.Object(
  {
    evidenceId: Type.String(),
    issueType: FieldEvidenceIssueTypeSchema,
    similarityScore: Type.Number({ minimum: 0, maximum: 1 }),
    matchedFields: Type.Array(Type.String()),
    differences: Type.Array(Type.String()),
    reason: Type.String(),
  },
  { additionalProperties: false },
);
export const SimilarEvidenceResponseSchema = Type.Array(
  SimilarEvidenceResponseItemSchema,
  { maxItems: 3 },
);
export type SimilarEvidenceResponse = readonly SimilarFieldEvidenceMatch[];

export interface PcPartCheckApiServices {
  checkCompatibility(request: CompatibilityCheckRequest): Promise<ResultSnapshot>;
  findSimilarEvidence(request: SimilarEvidenceRequest): Promise<SimilarEvidenceResponse>;
}
