import type { CanonicalUnit } from '@pcpartcheck/core';

import type {
  RawFieldEvidence,
  UnitNormalizationResult,
} from './evidence.js';

export const UNIT_NORMALIZER_VERSION = '1.0.0' as const;

export interface UnitNormalizationInput {
  readonly rawEvidence: RawFieldEvidence;
  readonly targetFieldPath: string;
  readonly targetUnit: CanonicalUnit;
}

interface Conversion {
  readonly factor: number;
  readonly ruleId: string;
  readonly targetUnit: CanonicalUnit;
}

const conversions = new Map<string, Conversion>([
  ['cm:mm', { factor: 10, ruleId: 'length.cm-to-mm', targetUnit: 'mm' }],
  ['m:mm', { factor: 1_000, ruleId: 'length.m-to-mm', targetUnit: 'mm' }],
  ['in:mm', { factor: 25.4, ruleId: 'length.in-to-mm', targetUnit: 'mm' }],
  ['kW:W', { factor: 1_000, ruleId: 'power.kw-to-w', targetUnit: 'W' }],
  ['mA:A', { factor: 0.001, ruleId: 'current.ma-to-a', targetUnit: 'A' }],
  ['TB:GB', { factor: 1_000, ruleId: 'storage.tb-to-gb', targetUnit: 'GB' }],
]);

export function normalizeUnit(
  input: UnitNormalizationInput,
): UnitNormalizationResult {
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
    unit: conversion.targetUnit,
    audit: {
      method: 'UNIT_CONVERSION',
      ruleId: conversion.ruleId,
      normalizerVersion: UNIT_NORMALIZER_VERSION,
      rawEvidence,
      targetFieldPath,
      normalizedValue,
      normalizedUnit: conversion.targetUnit,
    },
  };
}
