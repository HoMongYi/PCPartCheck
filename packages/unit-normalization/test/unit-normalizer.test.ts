import { expect, test } from 'vitest';

import * as unitNormalization from '../src/index.js';

function normalizeUnit(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const candidate = (
    unitNormalization as Readonly<Record<string, unknown>>
  ).normalizeUnit;
  expect(candidate, 'normalizeUnit must be exported').toBeTypeOf('function');
  return (
    candidate as (
      value: Readonly<Record<string, unknown>>,
    ) => Readonly<Record<string, unknown>>
  )(input);
}

function rawEvidence(rawValue: number, rawUnit: string) {
  return {
    evidenceId: `raw-${rawUnit}`,
    source: {
      providerId: 'fixture-provider',
      providerVersion: 'fixture-v1',
    },
    fieldPath: 'fixture.measurement',
    rawValue,
    rawUnit,
  } as const;
}

test.each([
  ['cm', 32, 320, 'length.cm-to-mm'],
  ['in', 12.5, 317.5, 'length.in-to-mm'],
])('converts %s to mm', (rawUnit, rawValue, expected, ruleId) => {
  const original = rawEvidence(rawValue, rawUnit);
  const result = normalizeUnit({
    rawEvidence: original,
    targetFieldPath: 'spec.lengthMm',
    targetUnit: 'mm',
  });

  expect(result).toMatchObject({
    status: 'NORMALIZED',
    value: expected,
    unit: 'mm',
    audit: {
      method: 'UNIT_CONVERSION',
      ruleId,
      rawEvidence: original,
    },
  });
});

test('converts kW to W', () => {
  const result = normalizeUnit({
    rawEvidence: rawEvidence(0.85, 'kW'),
    targetFieldPath: 'spec.ratedPowerW',
    targetUnit: 'W',
  });

  expect(result).toMatchObject({ status: 'NORMALIZED', value: 850, unit: 'W' });
});

test('converts mA to A', () => {
  const result = normalizeUnit({
    rawEvidence: rawEvidence(750, 'mA'),
    targetFieldPath: 'spec.maxCurrentA',
    targetUnit: 'A',
  });

  expect(result).toMatchObject({ status: 'NORMALIZED', value: 0.75, unit: 'A' });
});

test('converts actual frequency from GHz to MHz', () => {
  const result = normalizeUnit({
    rawEvidence: rawEvidence(3, 'GHz'),
    targetFieldPath: 'spec.clockMHz',
    targetUnit: 'MHz',
  });

  expect(result).toMatchObject({
    status: 'NORMALIZED',
    value: 3000,
    unit: 'MHz',
  });
});

test('rejects general MHz to MT/s conversion as a dimension mismatch', () => {
  const result = normalizeUnit({
    rawEvidence: rawEvidence(6000, 'MHz'),
    targetFieldPath: 'spec.dataRateMtps',
    targetUnit: 'MT/s',
  });

  expect(result).toMatchObject({
    status: 'UNKNOWN',
    reason: 'DIMENSION_MISMATCH',
  });
});

test('rejects unsupported source units', () => {
  const original = rawEvidence(1, 'furlong');
  const result = normalizeUnit({
    rawEvidence: original,
    targetFieldPath: 'spec.lengthMm',
    targetUnit: 'mm',
  });

  expect(result).toEqual({
    status: 'UNKNOWN',
    reason: 'UNSUPPORTED_UNIT',
    rawEvidence: original,
    targetFieldPath: 'spec.lengthMm',
    targetUnit: 'mm',
  });
});

test('keeps actual MHz values as frequency identity normalization', () => {
  const result = normalizeUnit({
    rawEvidence: rawEvidence(3000, 'MHz'),
    targetFieldPath: 'spec.clockMHz',
    targetUnit: 'MHz',
  });

  expect(result).toMatchObject({
    status: 'NORMALIZED',
    value: 3000,
    unit: 'MHz',
    audit: { method: 'IDENTITY', rawEvidence: rawEvidence(3000, 'MHz') },
  });
});

test('returns unknown for a non-finite source value', () => {
  const result = normalizeUnit({
    rawEvidence: rawEvidence(Number.NaN, 'mm'),
    targetFieldPath: 'spec.lengthMm',
    targetUnit: 'mm',
  });

  expect(result).toMatchObject({ status: 'UNKNOWN', reason: 'INVALID_VALUE' });
});
