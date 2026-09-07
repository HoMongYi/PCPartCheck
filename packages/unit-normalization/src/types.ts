import type { CanonicalUnit, JsonValue } from '@pcpartcheck/core';

export type UnitDimension =
  | 'LENGTH'
  | 'POWER'
  | 'CURRENT'
  | 'VOLTAGE'
  | 'DATA_RATE'
  | 'FREQUENCY'
  | 'STORAGE';

export interface RawUnitEvidence {
  readonly rawValue: JsonValue;
  readonly rawUnit?: string;
}

export interface UnitNormalizationAudit<
  TRawEvidence extends RawUnitEvidence = RawUnitEvidence,
> {
  readonly method: 'IDENTITY' | 'UNIT_CONVERSION';
  readonly ruleId: string;
  readonly normalizerVersion: string;
  readonly rawEvidence: TRawEvidence;
  readonly targetFieldPath: string;
  readonly normalizedValue: number;
  readonly normalizedUnit: CanonicalUnit;
}

export interface NormalizedUnitValue<
  TRawEvidence extends RawUnitEvidence = RawUnitEvidence,
> {
  readonly status: 'NORMALIZED';
  readonly value: number;
  readonly unit: CanonicalUnit;
  readonly audit: UnitNormalizationAudit<TRawEvidence>;
}

export interface UnknownUnitValue<
  TRawEvidence extends RawUnitEvidence = RawUnitEvidence,
> {
  readonly status: 'UNKNOWN';
  readonly reason:
    | 'INVALID_VALUE'
    | 'UNSUPPORTED_UNIT'
    | 'DIMENSION_MISMATCH'
    | 'UNSUPPORTED_CONVERSION';
  readonly rawEvidence: TRawEvidence;
  readonly targetFieldPath: string;
  readonly targetUnit: CanonicalUnit;
}

export type UnitNormalizationResult<
  TRawEvidence extends RawUnitEvidence = RawUnitEvidence,
> = NormalizedUnitValue<TRawEvidence> | UnknownUnitValue<TRawEvidence>;
