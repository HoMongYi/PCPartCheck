import type { CanonicalUnit } from '@pcpartcheck/core';

import type {
  RawUnitEvidence,
  UnitDimension,
  UnitNormalizationResult,
} from './types.js';

export const UNIT_NORMALIZER_VERSION = '1.0.0' as const;

export interface UnitNormalizationInput<
  TRawEvidence extends RawUnitEvidence = RawUnitEvidence,
> {
  readonly rawEvidence: TRawEvidence;
  readonly targetFieldPath: string;
  readonly targetUnit: CanonicalUnit;
}

interface UnitDefinition {
  readonly dimension: UnitDimension;
}

interface Conversion {
  readonly factor: number;
  readonly ruleId: string;
}

const units = new Map<string, UnitDefinition>([
  ['mm', { dimension: 'LENGTH' }],
  ['cm', { dimension: 'LENGTH' }],
  ['m', { dimension: 'LENGTH' }],
  ['in', { dimension: 'LENGTH' }],
  ['W', { dimension: 'POWER' }],
  ['kW', { dimension: 'POWER' }],
  ['A', { dimension: 'CURRENT' }],
  ['mA', { dimension: 'CURRENT' }],
  ['V', { dimension: 'VOLTAGE' }],
  ['MT/s', { dimension: 'DATA_RATE' }],
  ['MHz', { dimension: 'FREQUENCY' }],
  ['GHz', { dimension: 'FREQUENCY' }],
  ['GB', { dimension: 'STORAGE' }],
  ['TB', { dimension: 'STORAGE' }],
]);

const conversions = new Map<string, Conversion>([
  ['cm:mm', { factor: 10, ruleId: 'length.cm-to-mm' }],
  ['m:mm', { factor: 1_000, ruleId: 'length.m-to-mm' }],
  ['in:mm', { factor: 25.4, ruleId: 'length.in-to-mm' }],
  ['kW:W', { factor: 1_000, ruleId: 'power.kw-to-w' }],
  ['mA:A', { factor: 0.001, ruleId: 'current.ma-to-a' }],
  ['GHz:MHz', { factor: 1_000, ruleId: 'frequency.ghz-to-mhz' }],
  ['TB:GB', { factor: 1_000, ruleId: 'storage.tb-to-gb' }],
  ['GB:TB', { factor: 0.001, ruleId: 'storage.gb-to-tb' }],
]);

export function normalizeUnit<TRawEvidence extends RawUnitEvidence>(
  input: UnitNormalizationInput<TRawEvidence>,
): UnitNormalizationResult<TRawEvidence> {
  const { rawEvidence, targetFieldPath, targetUnit } = input;
  const rawValue = rawEvidence.rawValue;

  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return {
      status: 'UNKNOWN',
      reason: 'INVALID_VALUE',
      rawEvidence,
      targetFieldPath,
      targetUnit,
    };
  }

  const sourceUnit = rawEvidence.rawUnit;
  const sourceDefinition = sourceUnit ? units.get(sourceUnit) : undefined;
  const targetDefinition = units.get(targetUnit);
  if (!sourceDefinition || !targetDefinition) {
    return {
      status: 'UNKNOWN',
      reason: 'UNSUPPORTED_UNIT',
      rawEvidence,
      targetFieldPath,
      targetUnit,
    };
  }

  if (sourceDefinition.dimension !== targetDefinition.dimension) {
    return {
      status: 'UNKNOWN',
      reason: 'DIMENSION_MISMATCH',
      rawEvidence,
      targetFieldPath,
      targetUnit,
    };
  }

  if (sourceUnit === targetUnit) {
    return {
      status: 'NORMALIZED',
      value: rawValue,
      unit: targetUnit,
      audit: {
        method: 'IDENTITY',
        ruleId: `identity.${targetUnit}`,
        normalizerVersion: UNIT_NORMALIZER_VERSION,
        rawEvidence,
        targetFieldPath,
        normalizedValue: rawValue,
        normalizedUnit: targetUnit,
      },
    };
  }

  const conversion = conversions.get(`${sourceUnit}:${targetUnit}`);
  if (!conversion) {
    return {
      status: 'UNKNOWN',
      reason: 'UNSUPPORTED_CONVERSION',
      rawEvidence,
      targetFieldPath,
      targetUnit,
    };
  }

  const normalizedValue = rawValue * conversion.factor;
  return {
    status: 'NORMALIZED',
    value: normalizedValue,
    unit: targetUnit,
    audit: {
      method: 'UNIT_CONVERSION',
      ruleId: conversion.ruleId,
      normalizerVersion: UNIT_NORMALIZER_VERSION,
      rawEvidence,
      targetFieldPath,
      normalizedValue,
      normalizedUnit: targetUnit,
    },
  };
}
