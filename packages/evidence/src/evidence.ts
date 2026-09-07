import type { CanonicalUnit, JsonValue } from '@pcpartcheck/core';

export type EvidenceRole =
  | 'TECHNICAL_SPEC'
  | 'RETAIL_IDENTITY'
  | 'FIELD_EVIDENCE';

export interface EvidenceSource {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly sourceUri?: string;
  readonly license?: string;
  readonly attributionRequired?: boolean;
}

export interface RawFieldEvidence {
  readonly evidenceId: string;
  readonly role: EvidenceRole;
  readonly source: EvidenceSource;
  readonly capturedAt: string;
  readonly fieldPath: string;
  readonly rawValue: JsonValue;
  readonly rawUnit?: string;
}

export interface UnitNormalizationAudit {
  readonly method: 'IDENTITY' | 'UNIT_CONVERSION';
  readonly ruleId: string;
  readonly normalizerVersion: string;
  readonly rawEvidence: RawFieldEvidence;
  readonly targetFieldPath: string;
  readonly normalizedValue: number;
  readonly normalizedUnit: CanonicalUnit;
}

export interface NormalizedUnitValue {
  readonly status: 'NORMALIZED';
  readonly value: number;
  readonly unit: CanonicalUnit;
  readonly audit: UnitNormalizationAudit;
}

export interface UnknownUnitValue {
  readonly status: 'UNKNOWN';
  readonly reason: 'INVALID_VALUE' | 'UNSUPPORTED_CONVERSION';
  readonly rawEvidence: RawFieldEvidence;
  readonly targetFieldPath: string;
  readonly targetUnit: CanonicalUnit;
}

export type UnitNormalizationResult = NormalizedUnitValue | UnknownUnitValue;
