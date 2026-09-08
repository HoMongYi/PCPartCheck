import type {
  FieldEvidenceQuery,
  FieldEvidenceRecord,
  FieldMeasurement,
} from '@pcpartcheck/evidence';
import { describe, expect, test } from 'vitest';

import * as similarity from '../src/index.js';

type Ranker = (input: {
  readonly query: FieldEvidenceQuery & {
    readonly measurements?: readonly FieldMeasurement[];
  };
  readonly records: readonly FieldEvidenceRecord[];
}) => readonly Readonly<Record<string, unknown>>[];

function ranker(): Ranker {
  const candidate = (similarity as Readonly<Record<string, unknown>>)
    .rankSimilarFieldEvidence;
  expect(candidate, 'rankSimilarFieldEvidence must be exported').toBeDefined();
  return candidate as Ranker;
}

const query: FieldEvidenceQuery & {
  readonly measurements: readonly FieldMeasurement[];
} = {
  issueType: 'PHYSICAL_CLEARANCE',
  parts: [
    { category: 'GPU', partId: '11111111-1111-4111-8111-111111111111' },
    { category: 'PC_CASE', partId: '22222222-2222-4222-8222-222222222222' },
  ],
  installationContext: {
    schemaVersion: '1.0.0',
    radiators: [
      {
        position: 'FRONT',
        sizeMm: 360,
        radiatorThicknessMm: 30,
        fanThicknessMm: 25,
      },
    ],
    hddCages: [],
    gpuOrientation: 'HORIZONTAL',
    occupiedPcieSlotIds: [],
    pciePower: {
      independentCableCount: 2,
      native12VhpwrCableCount: 0,
      native12V2x6CableCount: 0,
      adapterUsed: false,
    },
  },
  measurements: [
    { fieldPath: 'gpu.lengthMm', value: 330, unit: 'mm' },
    { fieldPath: 'case.maxGpuLengthMm', value: 350, unit: 'mm' },
  ],
};

function fieldRecord(
  evidenceId: string,
  options: {
    status?: 'DRAFT' | 'APPROVED' | 'REJECTED';
    gpuLengthMm?: number;
    caseLengthMm?: number;
    radiatorPosition?: 'FRONT' | 'TOP' | 'BOTTOM' | 'REAR' | 'SIDE';
    radiatorSizeMm?: number;
  } = {},
): FieldEvidenceRecord {
  return {
    schemaVersion: '2.0.0',
    evidenceId,
    status: options.status ?? 'APPROVED',
    visibility: 'PUBLIC',
    redaction: 'NONE',
    outcome: 'ASSEMBLY_FAILURE',
    issueType: 'PHYSICAL_CLEARANCE',
    parts: [
      { category: 'GPU', partId: '33333333-3333-4333-8333-333333333333' },
      { category: 'PC_CASE', partId: '22222222-2222-4222-8222-222222222222' },
    ],
    installationContext: {
      ...query.installationContext,
      radiators: [
        {
          position: options.radiatorPosition ?? 'FRONT',
          sizeMm: options.radiatorSizeMm ?? 360,
          radiatorThicknessMm: 30,
          fanThicknessMm: 25,
        },
      ],
    },
    measurements: [
      {
        fieldPath: 'gpu.lengthMm',
        value: options.gpuLengthMm ?? 330,
        unit: 'mm',
      },
      {
        fieldPath: 'case.maxGpuLengthMm',
        value: options.caseLengthMm ?? 350,
        unit: 'mm',
      },
    ],
    reportedAt: '2026-09-08T00:00:00.000Z',
  };
}

describe('rankSimilarFieldEvidence', () => {
  test('returns at most the deterministic top three', () => {
    const results = ranker()({
      query,
      records: [
        fieldRecord('fourth', { gpuLengthMm: 390 }),
        fieldRecord('first', { gpuLengthMm: 331 }),
        fieldRecord('third', { gpuLengthMm: 350 }),
        fieldRecord('second', { gpuLengthMm: 340 }),
      ],
    });

    expect(results).toHaveLength(3);
    expect(results.map((result) => result.evidenceId)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  test('breaks equal-score ties by evidence id', () => {
    const results = ranker()({
      query,
      records: [fieldRecord('b'), fieldRecord('a')],
    });

    expect(results.map((result) => result.evidenceId)).toEqual(['a', 'b']);
  });

  test('weights radiator position and size plus GPU length for physical clearance', () => {
    const [result] = ranker()({
      query,
      records: [
        fieldRecord('different-layout', {
          gpuLengthMm: 331,
          radiatorPosition: 'TOP',
          radiatorSizeMm: 240,
        }),
        fieldRecord('same-layout', { gpuLengthMm: 340 }),
      ],
    });

    expect(result?.evidenceId).toBe('same-layout');
  });

  test('explains matched fields and differences', () => {
    const [result] = ranker()({
      query,
      records: [fieldRecord('explained', { gpuLengthMm: 340 })],
    });

    expect(result?.matchedFields).toEqual(expect.arrayContaining(['parts.PC_CASE']));
    expect(result?.differences).toEqual(
      expect.arrayContaining(['measurements.gpu.lengthMm']),
    );
    expect(result?.reason).toEqual(expect.any(String));
  });

  test('excludes draft and rejected evidence', () => {
    const results = ranker()({
      query,
      records: [
        fieldRecord('draft', { status: 'DRAFT' }),
        fieldRecord('rejected', { status: 'REJECTED' }),
        fieldRecord('approved'),
      ],
    });

    expect(results.map((result) => result.evidenceId)).toEqual(['approved']);
  });

  test('returns no compatibility status or decision even for failure evidence', () => {
    const [result] = ranker()({ query, records: [fieldRecord('failure')] });

    expect(result).toMatchObject({ issueType: 'PHYSICAL_CLEARANCE' });
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('decision');
  });
});
