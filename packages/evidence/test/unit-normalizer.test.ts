import { expect, test } from 'vitest';

import * as evidence from '../src/index.js';

function normalizeUnit(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const candidate = (evidence as Readonly<Record<string, unknown>>)
    .normalizeUnit;
  expect(candidate, 'normalizeUnit must be exported').toBeTypeOf('function');
  return (
    candidate as (
      value: Readonly<Record<string, unknown>>,
    ) => Readonly<Record<string, unknown>>
  )(input);
}

const rawEvidence = {
  evidenceId: 'raw-gpu-length',
  role: 'TECHNICAL_SPEC',
  source: {
    providerId: 'fixture-provider',
    providerVersion: 'fixture-v1',
  },
  capturedAt: '2026-09-08T00:00:00.000Z',
  fieldPath: 'gpu.length',
  rawValue: 32,
  rawUnit: 'cm',
} as const;

test('converts compatible units and retains the original field evidence', () => {
  const result = normalizeUnit({
    rawEvidence,
    targetFieldPath: 'spec.lengthMm',
    targetUnit: 'mm',
  });

  expect(result).toMatchObject({
    status: 'NORMALIZED',
    value: 320,
    unit: 'mm',
    audit: {
      method: 'UNIT_CONVERSION',
      ruleId: 'length.cm-to-mm',
      normalizerVersion: '1.0.0',
      rawEvidence,
    },
  });
});

test('does not reinterpret MHz as DDR data rate', () => {
  const result = normalizeUnit({
    rawEvidence: {
      ...rawEvidence,
      evidenceId: 'raw-memory-speed',
      fieldPath: 'memory.speed',
      rawValue: 6000,
      rawUnit: 'MHz',
    },
    targetFieldPath: 'spec.dataRateMtps',
    targetUnit: 'MT/s',
  });

  expect(result).toMatchObject({
    status: 'UNKNOWN',
    reason: 'UNSUPPORTED_CONVERSION',
  });
});

test('keeps MT/s and MHz identity normalization separate', () => {
  const dataRate = normalizeUnit({
    rawEvidence: {
      ...rawEvidence,
      fieldPath: 'memory.dataRate',
      rawValue: 6000,
      rawUnit: 'MT/s',
    },
    targetFieldPath: 'spec.dataRateMtps',
    targetUnit: 'MT/s',
  });
  const clock = normalizeUnit({
    rawEvidence: {
      ...rawEvidence,
      fieldPath: 'memory.clock',
      rawValue: 3000,
      rawUnit: 'MHz',
    },
    targetFieldPath: 'spec.clockMHz',
    targetUnit: 'MHz',
  });

  expect(dataRate).toMatchObject({ status: 'NORMALIZED', value: 6000 });
  expect(clock).toMatchObject({ status: 'NORMALIZED', value: 3000 });
});

test('returns unknown for a non-finite source value', () => {
  const result = normalizeUnit({
    rawEvidence: { ...rawEvidence, rawValue: Number.NaN },
    targetFieldPath: 'spec.lengthMm',
    targetUnit: 'mm',
  });

  expect(result).toMatchObject({
    status: 'UNKNOWN',
    reason: 'INVALID_VALUE',
  });
});
