import type { InstallationContext, RuleEvaluation } from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as evidence from '../src/index.js';

type MatchClassifier = (
  record: Readonly<Record<string, unknown>>,
  query: Readonly<Record<string, unknown>>,
) => string;
type EvidenceApplier = (
  base: RuleEvaluation,
  records: readonly Readonly<Record<string, unknown>>[],
  query: Readonly<Record<string, unknown>>,
) => RuleEvaluation;

function exportedFunction<T>(name: string): T {
  const candidate = (evidence as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as T;
}

const installationContext: InstallationContext = {
  schemaVersion: '1.0.0',
  radiators: [
    {
      position: 'FRONT',
      sizeMm: 360,
      radiatorThicknessMm: 30,
      fanThicknessMm: 25,
    },
  ],
  hddCages: [{ cageId: 'lower', position: 'BOTTOM', installed: false }],
  gpuOrientation: 'HORIZONTAL',
  occupiedPcieSlotIds: ['pcie-1'],
  pciePower: {
    independentCableCount: 2,
    native12VhpwrCableCount: 0,
    native12V2x6CableCount: 0,
    adapterUsed: false,
  },
};

const parts = [
  { category: 'GPU', partId: '11111111-1111-4111-8111-111111111111' },
  { category: 'PC_CASE', partId: '22222222-2222-4222-8222-222222222222' },
] as const;

const query = {
  issueType: 'PHYSICAL_CLEARANCE',
  parts,
  installationContext,
} as const;

function record(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1.0.0',
    evidenceId: 'field-1',
    status: 'APPROVED',
    visibility: 'PUBLIC',
    outcome: 'ASSEMBLY_FAILURE',
    issueType: 'PHYSICAL_CLEARANCE',
    parts,
    installationContext,
    reportedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

const unknownBase: RuleEvaluation = {
  status: 'UNKNOWN',
  summary: 'Canonical clearance data is incomplete',
  reasons: ['GPU length is missing'],
  evidenceIds: [],
};

describe('classifyFieldEvidenceMatch', () => {
  test('treats reordered part references and typed context arrays as exact', () => {
    const classify = exportedFunction<MatchClassifier>('classifyFieldEvidenceMatch');
    const result = classify(
      record({
        parts: [...parts].reverse(),
        installationContext: {
          ...installationContext,
          customFacts: { note: 'not part of exact matching' },
        },
      }),
      query,
    );

    expect(result).toBe('EXACT');
  });

  test('classifies a different typed installation context as similar', () => {
    const classify = exportedFunction<MatchClassifier>('classifyFieldEvidenceMatch');
    const result = classify(
      record({
        installationContext: {
          ...installationContext,
          gpuOrientation: 'VERTICAL',
        },
      }),
      query,
    );

    expect(result).toBe('SIMILAR');
  });
});

describe('applyExactFieldEvidence', () => {
  test('turns an approved exact assembly failure into incompatible', () => {
    const apply = exportedFunction<EvidenceApplier>('applyExactFieldEvidence');
    const result = apply(unknownBase, [record()], query);

    expect(result).toMatchObject({
      status: 'INCOMPATIBLE',
      evidenceIds: ['field-1'],
    });
  });

  test('uses conditional when the exact failure has explicit resolution conditions', () => {
    const apply = exportedFunction<EvidenceApplier>('applyExactFieldEvidence');
    const result = apply(
      unknownBase,
      [
        record({
          conditions: [
            {
              code: 'REMOVE_FRONT_RADIATOR',
              message: 'Move or remove the front radiator before installing the GPU',
            },
          ],
        }),
      ],
      query,
    );

    expect(result).toMatchObject({
      status: 'CONDITIONAL',
      conditions: [{ code: 'REMOVE_FRONT_RADIATOR' }],
    });
  });

  test('does not let one exact success override a hard-rule failure', () => {
    const apply = exportedFunction<EvidenceApplier>('applyExactFieldEvidence');
    const hardFailure: RuleEvaluation = {
      status: 'INCOMPATIBLE',
      summary: 'GPU is longer than the available clearance',
      reasons: ['350 mm exceeds 340 mm'],
      evidenceIds: [],
    };
    const result = apply(
      hardFailure,
      [record({ outcome: 'ASSEMBLY_SUCCESS' })],
      query,
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test.each(['DRAFT', 'REJECTED'])(
    'ignores %s field evidence',
    (status) => {
      const apply = exportedFunction<EvidenceApplier>('applyExactFieldEvidence');
      expect(apply(unknownBase, [record({ status })], query)).toEqual(unknownBase);
    },
  );

  test('does not apply a failure from a different installation context', () => {
    const apply = exportedFunction<EvidenceApplier>('applyExactFieldEvidence');
    const similar = record({
      installationContext: {
        ...installationContext,
        gpuOrientation: 'VERTICAL',
      },
    });

    expect(apply(unknownBase, [similar], query)).toEqual(unknownBase);
  });

  test('an unconditional exact failure wins over exact success and conditional failure', () => {
    const apply = exportedFunction<EvidenceApplier>('applyExactFieldEvidence');
    const result = apply(
      unknownBase,
      [
        record({ evidenceId: 'success', outcome: 'ASSEMBLY_SUCCESS' }),
        record({
          evidenceId: 'conditional',
          conditions: [{ code: 'CHANGE_LAYOUT', message: 'Change the installation layout' }],
        }),
        record({ evidenceId: 'hard-failure' }),
      ],
      query,
    );

    expect(result).toMatchObject({
      status: 'INCOMPATIBLE',
      evidenceIds: ['hard-failure'],
    });
  });
});
