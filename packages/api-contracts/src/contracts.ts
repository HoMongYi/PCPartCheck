import {
  BuildIntentSchema,
  CanonicalBuildSchema,
  CanonicalPartSchema,
  CapabilityModeSchema,
  GpuOrientationSchema,
  InstalledHddCageSchema,
  InstalledRadiatorSchema,
  PciePowerInstallationSchema,
  type CanonicalPart,
  type CompatibilityCheckInput,
  type PolicyProfile,
  type ResultSnapshot,
} from '@pcpartcheck/core';
import {
  FieldEvidenceConditionSchema,
  FieldEvidenceIssueTypeSchema,
  FieldEvidencePartReferenceSchema,
  FieldEvidenceRecordSchema,
  FieldEvidenceRedactionSchema,
  FieldEvidenceVisibilitySchema,
  FieldMeasurementSchema,
  type FieldEvidenceRecord,
  type RawFieldEvidence,
} from '@pcpartcheck/evidence';
import type {
  SimilarFieldEvidenceMatch,
  SimilarityQuery,
} from '@pcpartcheck/similarity';
import { Type, type Static } from '@sinclair/typebox';

export { FieldEvidenceRecordSchema } from '@pcpartcheck/evidence';
export type { FieldEvidenceRecord } from '@pcpartcheck/evidence';

export const HealthResponseSchema = Type.Object(
  {
    status: Type.Literal('ok'),
    service: Type.Literal('pcpartcheck'),
    canonicalSchemaVersion: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
export type HealthResponse = Static<typeof HealthResponseSchema>;

/*
 * TypeBox assigns the same generated $ref name when Core's recursive JsonValue
 * schema is embedded more than once in a Fastify route. Recursive JSON values
 * stay opaque at HTTP serialization time; compatibility inputs are revalidated
 * with Core's JsonValueSchema before the engine evaluates any rule.
 */
const RecursiveJsonValueBoundarySchema = Type.Any({
  description: 'JSON value validated again by the deterministic engine boundary',
});

export const ApiInstallationContextSchema = Type.Object(
  {
    schemaVersion: Type.Literal('1.0.0'),
    radiators: Type.Array(InstalledRadiatorSchema),
    hddCages: Type.Array(InstalledHddCageSchema),
    gpuOrientation: GpuOrientationSchema,
    occupiedPcieSlotIds: Type.Array(Type.String({ minLength: 1 }), {
      uniqueItems: true,
    }),
    pciePower: PciePowerInstallationSchema,
    installedBiosVersion: Type.Optional(Type.String({ minLength: 1 })),
    customFacts: Type.Optional(
      Type.Record(Type.String(), RecursiveJsonValueBoundarySchema),
    ),
  },
  { additionalProperties: false },
);

export const ApiCapabilityPolicySchema = Type.Object(
  {
    capabilityId: Type.String({ minLength: 1 }),
    mode: CapabilityModeSchema,
    config: Type.Optional(
      Type.Record(Type.String(), RecursiveJsonValueBoundarySchema),
    ),
  },
  { additionalProperties: false },
);

export const ApiPolicyProfileSchema = Type.Object(
  {
    profileId: Type.String({ minLength: 1 }),
    policyVersion: Type.String({ minLength: 1 }),
    capabilities: Type.Array(ApiCapabilityPolicySchema),
  },
  { additionalProperties: false },
);

export const CompatibilityCheckRequestSchema = Type.Object(
  {
    build: CanonicalBuildSchema,
    intent: BuildIntentSchema,
    installationContext: ApiInstallationContextSchema,
    policyProfile: ApiPolicyProfileSchema,
    evidenceSnapshot: RecursiveJsonValueBoundarySchema,
  },
  { additionalProperties: false },
);
export type CompatibilityCheckRequest = CompatibilityCheckInput;

export const CompatibilityStatusSchema = Type.Union([
  Type.Literal('PASS'),
  Type.Literal('WARNING'),
  Type.Literal('CONDITIONAL'),
  Type.Literal('UNKNOWN'),
  Type.Literal('REVIEW_REQUIRED'),
  Type.Literal('INCOMPATIBLE'),
  Type.Literal('NOT_CHECKED'),
]);

export const CompatibilityDecisionSchema = Type.Union([
  Type.Literal('ALLOW'),
  Type.Literal('ALLOW_WITH_WARNING'),
  Type.Literal('ALLOW_IF_CONDITIONS_MET'),
  Type.Literal('REVIEW'),
  Type.Literal('BLOCK'),
  Type.Literal('NO_DECISION'),
]);

export const ActiveCoverageBucketSchema = Type.Object(
  {
    total: Type.Integer({ minimum: 0 }),
    evaluated: Type.Integer({ minimum: 0 }),
    unknown: Type.Integer({ minimum: 0 }),
    notChecked: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const DisabledCoverageBucketSchema = Type.Object(
  {
    total: Type.Integer({ minimum: 0 }),
    notChecked: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const CompatibilityCoverageSchema = Type.Object(
  {
    required: ActiveCoverageBucketSchema,
    advisory: ActiveCoverageBucketSchema,
    disabled: DisabledCoverageBucketSchema,
  },
  { additionalProperties: false },
);

export const CompatibilityIssueGroupsSchema = Type.Object(
  {
    blockingRuleIds: Type.Array(Type.String({ minLength: 1 })),
    reviewRuleIds: Type.Array(Type.String({ minLength: 1 })),
    advisoryRuleIds: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const RuleResultSchema = Type.Object(
  {
    ruleId: Type.String({ minLength: 1 }),
    capabilityId: Type.String({ minLength: 1 }),
    policyMode: CapabilityModeSchema,
    status: CompatibilityStatusSchema,
    summary: Type.String(),
    reasons: Type.Array(Type.String()),
    conditions: Type.Optional(Type.Array(FieldEvidenceConditionSchema)),
    evidenceIds: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const AggregatedCompatibilityResultSchema = Type.Object(
  {
    status: CompatibilityStatusSchema,
    decision: CompatibilityDecisionSchema,
    coverage: CompatibilityCoverageSchema,
    issues: CompatibilityIssueGroupsSchema,
    ruleResults: Type.Array(RuleResultSchema),
  },
  { additionalProperties: false },
);

export const ProviderVersionSchema = Type.Object(
  {
    providerId: Type.String({ minLength: 1 }),
    providerVersion: Type.String({ minLength: 1 }),
    commitSha: Type.Optional(Type.String({ minLength: 1 })),
    schemaFingerprint: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const CompatibilityInputSnapshotSchema = Type.Object(
  {
    build: CanonicalBuildSchema,
    intent: BuildIntentSchema,
    installationContext: ApiInstallationContextSchema,
    policyProfile: ApiPolicyProfileSchema,
  },
  { additionalProperties: false },
);

export const ResultSnapshotResponseSchema = Type.Object(
  {
    snapshotFormatVersion: Type.String({ minLength: 1 }),
    checkedAt: Type.String({ minLength: 1 }),
    engineVersion: Type.String({ minLength: 1 }),
    ruleSetVersion: Type.String({ minLength: 1 }),
    policyVersion: Type.String({ minLength: 1 }),
    canonicalSchemaVersion: Type.String({ minLength: 1 }),
    identityMapperVersion: Type.String({ minLength: 1 }),
    providerVersions: Type.Array(ProviderVersionSchema),
    inputSnapshot: CompatibilityInputSnapshotSchema,
    evidenceSnapshot: RecursiveJsonValueBoundarySchema,
    resultSnapshot: AggregatedCompatibilityResultSchema,
  },
  { additionalProperties: false },
);

export const CompatibilityCheckBatchRequestSchema = Type.Object(
  {
    requests: Type.Array(CompatibilityCheckRequestSchema, {
      minItems: 1,
      maxItems: 100,
    }),
  },
  { additionalProperties: false },
);
export type CompatibilityCheckBatchRequest = Static<
  typeof CompatibilityCheckBatchRequestSchema
>;

export const CompatibilityCheckBatchResponseSchema = Type.Object(
  { results: Type.Array(ResultSnapshotResponseSchema) },
  { additionalProperties: false },
);
export interface CompatibilityCheckBatchResponse {
  readonly results: readonly ResultSnapshot[];
}

export const PartCategorySchema = Type.Union([
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

export const PartsQuerySchema = Type.Object(
  {
    category: Type.Optional(PartCategorySchema),
    manufacturer: Type.Optional(Type.String({ minLength: 1 })),
    search: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);
export type PartsQuery = Static<typeof PartsQuerySchema>;

export const PartsResponseSchema = Type.Object(
  {
    items: Type.Array(CanonicalPartSchema),
    total: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export const CanonicalPartResponseSchema = CanonicalPartSchema;
export interface PartsResponse {
  readonly items: readonly CanonicalPart[];
  readonly total: number;
}

export const IdParamsSchema = Type.Object(
  { id: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
export type IdParams = Static<typeof IdParamsSchema>;

export const RawFieldEvidenceSchema = Type.Object(
  {
    evidenceId: Type.String({ minLength: 1 }),
    role: Type.Union([
      Type.Literal('TECHNICAL_SPEC'),
      Type.Literal('RETAIL_IDENTITY'),
      Type.Literal('FIELD_EVIDENCE'),
    ]),
    source: Type.Object(
      {
        providerId: Type.String({ minLength: 1 }),
        providerVersion: Type.String({ minLength: 1 }),
        sourceUri: Type.Optional(Type.String({ minLength: 1 })),
        license: Type.Optional(Type.String({ minLength: 1 })),
        attributionRequired: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    capturedAt: Type.String({ minLength: 1 }),
    fieldPath: Type.String({ minLength: 1 }),
    rawValue: RecursiveJsonValueBoundarySchema,
    rawUnit: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);
export const EvidenceResponseSchema = Type.Union([
  RawFieldEvidenceSchema,
  FieldEvidenceRecordSchema,
]);

export const SimilarEvidenceLookupSchema = Type.Object(
  {
    issueType: FieldEvidenceIssueTypeSchema,
    parts: Type.Array(FieldEvidencePartReferenceSchema),
    installationContext: ApiInstallationContextSchema,
    measurements: Type.Optional(Type.Array(FieldMeasurementSchema)),
  },
  { additionalProperties: false },
);
export type SimilarEvidenceLookup = SimilarityQuery;

export const SimilarEvidenceQueryStringSchema = Type.Object(
  {
    input: Type.String({
      minLength: 2,
      description: 'JSON-serialized SimilarEvidenceLookup object',
    }),
  },
  { additionalProperties: false },
);
export type SimilarEvidenceQueryString = Static<
  typeof SimilarEvidenceQueryStringSchema
>;

export const SimilarEvidenceResponseItemSchema = Type.Object(
  {
    evidenceId: Type.String({ minLength: 1 }),
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

export const CapabilityResponseItemSchema = Type.Object(
  {
    capabilityId: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export const CapabilitiesResponseSchema = Type.Array(CapabilityResponseItemSchema);
export type CapabilityResponseItem = Static<typeof CapabilityResponseItemSchema>;

export const ProfilesResponseSchema = Type.Array(ApiPolicyProfileSchema);
export type ProfilesResponse = readonly PolicyProfile[];

export const FieldEvidencePatchSchema = Type.Object(
  {
    visibility: Type.Optional(FieldEvidenceVisibilitySchema),
    redaction: Type.Optional(FieldEvidenceRedactionSchema),
    outcome: Type.Optional(Type.Union([
      Type.Literal('ASSEMBLY_SUCCESS'),
      Type.Literal('ASSEMBLY_FAILURE'),
    ])),
    issueType: Type.Optional(FieldEvidenceIssueTypeSchema),
    parts: Type.Optional(Type.Array(FieldEvidencePartReferenceSchema, { minItems: 1 })),
    installationContext: Type.Optional(ApiInstallationContextSchema),
    measurements: Type.Optional(Type.Array(FieldMeasurementSchema)),
    conditions: Type.Optional(Type.Array(FieldEvidenceConditionSchema)),
  },
  { additionalProperties: false, minProperties: 1 },
);
export type FieldEvidencePatch = Static<typeof FieldEvidencePatchSchema>;

export const ApiErrorResponseSchema = Type.Object(
  {
    error: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const DemoScenarioResultSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    summary: Type.String({ minLength: 1 }),
    status: CompatibilityStatusSchema,
    decision: CompatibilityDecisionSchema,
    blockingRuleIds: Type.Array(Type.String()),
    reviewRuleIds: Type.Array(Type.String()),
    advisoryRuleIds: Type.Array(Type.String()),
    coverage: CompatibilityCoverageSchema,
    ruleResults: Type.Array(RuleResultSchema),
    capabilities: Type.Array(
      Type.Object(
        {
          capabilityId: Type.String({ minLength: 1 }),
          mode: CapabilityModeSchema,
          status: CompatibilityStatusSchema,
        },
        { additionalProperties: false },
      ),
    ),
    powerBudget: Type.Optional(
      Type.Object(
        {
          estimatedPeakPowerW: Type.Number({ minimum: 0 }),
          minimumPsuW: Type.Number({ minimum: 0 }),
          calculatedRecommendedPsuW: Type.Number({ minimum: 0 }),
          recommendedPsuW: Type.Number({ minimum: 0 }),
          ratedPsuW: Type.Number({ minimum: 0 }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type DemoScenarioResult = Static<typeof DemoScenarioResultSchema>;

export const DemoDashboardResponseSchema = Type.Object(
  {
    scenarios: Type.Array(DemoScenarioResultSchema),
    exactEvidence: Type.Object(
      {
        evidenceId: Type.String({ minLength: 1 }),
        issueType: FieldEvidenceIssueTypeSchema,
        fieldEvidenceStatus: Type.Union([
          Type.Literal('DRAFT'),
          Type.Literal('APPROVED'),
          Type.Literal('REJECTED'),
        ]),
        visibility: FieldEvidenceVisibilitySchema,
        redaction: FieldEvidenceRedactionSchema,
        outcome: Type.Union([
          Type.Literal('ASSEMBLY_SUCCESS'),
          Type.Literal('ASSEMBLY_FAILURE'),
        ]),
        match: Type.Literal('EXACT'),
        resultStatus: CompatibilityStatusSchema,
      },
      { additionalProperties: false },
    ),
    similarEvidence: SimilarEvidenceResponseSchema,
  },
  { additionalProperties: false },
);
export type DemoDashboardResponse = Static<typeof DemoDashboardResponseSchema>;

export type AuthorizationAction =
  | 'FIELD_EVIDENCE_READ_STAFF'
  | 'FIELD_EVIDENCE_READ_ADMIN'
  | 'FIELD_EVIDENCE_WRITE'
  | 'FIELD_EVIDENCE_APPROVE';

export interface AuthorizationRequest {
  readonly credential?: string;
  readonly action: AuthorizationAction;
}

export interface AuthorizationDecision {
  readonly authenticated: boolean;
  readonly allowed: boolean;
  readonly principalId?: string;
}

export interface AuthorizationProvider {
  authorize(request: AuthorizationRequest): Promise<AuthorizationDecision>;
}

export interface RateLimitRequest {
  readonly key: string;
  readonly routeId: string;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RateLimitProvider {
  consume(request: RateLimitRequest): Promise<RateLimitDecision>;
}

export interface PcPartCheckApiServices {
  checkCompatibility(request: CompatibilityCheckRequest): Promise<ResultSnapshot>;
  checkCompatibilityBatch(
    request: CompatibilityCheckBatchRequest,
  ): Promise<CompatibilityCheckBatchResponse>;
  listParts(query: PartsQuery): Promise<PartsResponse>;
  getPart(partId: string): Promise<CanonicalPart | undefined>;
  getEvidence(evidenceId: string): Promise<RawFieldEvidence | FieldEvidenceRecord | undefined>;
  findSimilarEvidence(query: SimilarEvidenceLookup): Promise<SimilarEvidenceResponse>;
  listCapabilities(): Promise<readonly CapabilityResponseItem[]>;
  listProfiles(): Promise<ProfilesResponse>;
  createFieldEvidence(record: FieldEvidenceRecord): Promise<FieldEvidenceRecord>;
  patchFieldEvidence(
    evidenceId: string,
    patch: FieldEvidencePatch,
  ): Promise<FieldEvidenceRecord | undefined>;
  approveFieldEvidence(evidenceId: string): Promise<FieldEvidenceRecord | undefined>;
  getDemoDashboard(): Promise<DemoDashboardResponse>;
}
