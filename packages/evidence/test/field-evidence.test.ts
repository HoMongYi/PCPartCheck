import type { RuleEvaluation } from '@pcpartcheck/core';
import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { describe, expect, test } from 'vitest';

import * as evidence from '../src/index.js';

type JsonRecord = Readonly<Record<string, unknown>>;
type MatchClassifier = (record: JsonRecord, query: JsonRecord) => string;
type SnapshotValidator = (snapshot: JsonRecord) => JsonRecord;
type ActiveSelector = (snapshot: JsonRecord) => JsonRecord;
type EvidenceApplier = (
  base: RuleEvaluation,
  records: readonly JsonRecord[],
  query: JsonRecord,
) => RuleEvaluation;

function exported<T>(name: string): T {
  const candidate = (evidence as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as T;
}

const gpuId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';

const parts = [
  { category: 'GPU', partId: gpuId, hardwareRevision: 'A1' },
  { category: 'PC_CASE', partId: caseId, hardwareRevision: 'B2' },
] as const;

const installationContext = {
  schemaVersion: '2.1.0',
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
  componentRevisions: [
    { partId: gpuId, hardwareRevision: 'A1' },
    { partId: caseId, hardwareRevision: 'B2' },
  ],
  installedBiosVersion: 'F12',
} as const;

const exactScope = {
  requiredPartCategories: ['GPU', 'PC_CASE'],
  requiredContextFields: [
    'radiators',
    'hddCages',
    'gpuOrientation',
    'installedBiosVersion',
    'componentRevisions',
  ],
} as const;

const query = {
  issueType: 'PHYSICAL_CLEARANCE',
  parts: parts.map(({ category, partId }) => ({ category, partId })),
  installationContext,
} as const;

function record(overrides: JsonRecord = {}): JsonRecord {
  return {
    schemaVersion: '4.0.0',
    evidenceId: 'field-1',
    status: 'APPROVED',
    visibility: 'PUBLIC',
    redaction: 'NONE',
    outcome: 'ASSEMBLY_FAILURE',
    issueType: 'PHYSICAL_CLEARANCE',
    parts,
    exactScope,
    installationContext,
    reportedAt: '2026-09-08T00:00:00.000Z',
    createdByPrincipalId: 'reporter-1',
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T01:00:00.000Z',
    moderatedByPrincipalId: 'moderator-1',
    moderatedAt: '2026-09-08T01:00:00.000Z',
    ...overrides,
  };
}

function legacyRecord(overrides: JsonRecord = {}): JsonRecord {
  const legacy: Record<string, unknown> = { ...record(overrides) };
  delete legacy.exactScope;
  return {
    ...legacy,
    schemaVersion: '3.0.0',
    parts: parts.map(({ category, partId }) => ({ category, partId })),
  };
}

function snapshot(records: readonly JsonRecord[]): JsonRecord {
  return {
    fieldEvidenceSchemaVersion: '4.0.0',
    evidencePolicyVersion: '1.0.0',
    records,
  };
}

const unknownBase: RuleEvaluation = {
  status: 'UNKNOWN',
  summary: 'Canonical clearance data is incomplete',
  reasons: ['GPU length is missing'],
  evidenceIds: [],
};

describe('Field Evidence 4.0 public contract', () => {
  test('retains a discriminated v3/v4 read union and exposes a v4 snapshot', () => {
    expect(exported<string>('FIELD_EVIDENCE_SCHEMA_VERSION')).toBe('4.0.0');
    expect(exported<string>('FIELD_EVIDENCE_POLICY_VERSION')).toBe('1.0.0');

    const readSchema = exported<TSchema>('FieldEvidenceRecordSchema');
    const currentSchema = exported<TSchema>('FieldEvidenceRecordV4Schema');
    const snapshotSchema = exported<TSchema>('FieldEvidenceSnapshotSchema');

    expect(Value.Check(readSchema, legacyRecord())).toBe(true);
    expect(Value.Check(readSchema, legacyRecord({
      installationContext: {
        schemaVersion: '2.0.0',
        radiators: [],
        installedBiosVersion: 'F12',
      },
    }))).toBe(true);
    expect(Value.Check(readSchema, record())).toBe(true);
    expect(Value.Check(currentSchema, legacyRecord())).toBe(false);
    expect(Value.Check(currentSchema, record())).toBe(true);
    expect(Value.Check(snapshotSchema, snapshot([record()]))).toBe(true);
    expect(
      Value.Check(snapshotSchema, {
        ...snapshot([record()]),
        evidencePolicyVersion: '2.0.0',
      }),
    ).toBe(false);
  });

  test('does not silently reinterpret a historical v3 record as exact', () => {
    const classify = exported<MatchClassifier>('classifyFieldEvidenceMatch');
    expect(classify(legacyRecord(), query)).toBe('SIMILAR');
  });
});

describe('revision-aware exact applicability', () => {
  const classify = () => exported<MatchClassifier>('classifyFieldEvidenceMatch');

  test('accepts reordered complete parts and context arrays without mutation', () => {
    const current = record({
      parts: [...parts].reverse(),
      installationContext: {
        ...installationContext,
        componentRevisions: [...installationContext.componentRevisions].reverse(),
        customFacts: { ignored: true },
      },
      exactScope: {
        requiredPartCategories: [...exactScope.requiredPartCategories].reverse(),
        requiredContextFields: [...exactScope.requiredContextFields].reverse(),
      },
    });
    const before = JSON.stringify(current);

    expect(classify()(current, query)).toBe('EXACT');
    expect(JSON.stringify(current)).toBe(before);
  });

  test.each([
    [
      'one component mismatch',
      { parts: [{ category: 'GPU', partId: '33333333-3333-4333-8333-333333333333' }, query.parts[1]] },
    ],
    [
      'BIOS mismatch',
      { installationContext: { ...installationContext, installedBiosVersion: 'F11' } },
    ],
    [
      'hardware revision mismatch',
      {
        installationContext: {
          ...installationContext,
          componentRevisions: [
            { partId: gpuId, hardwareRevision: 'A2' },
            installationContext.componentRevisions[1],
          ],
        },
      },
    ],
    [
      'missing required context',
      {
        installationContext: {
          ...installationContext,
          gpuOrientation: undefined,
        },
      },
    ],
    ['extra build part', { parts: [...query.parts, { category: 'CPU', partId: '44444444-4444-4444-8444-444444444444' }] }],
    ['missing build part', { parts: [query.parts[0]] }],
  ])('%s remains similar', (_name, queryPatch) => {
    expect(classify()(record(), { ...query, ...queryPatch })).toBe('SIMILAR');
  });

  test.each([
    [
      'evidence revision',
      { parts: parts.map(({ category, partId }) => ({ category, partId })) },
      {},
    ],
    [
      'build revision',
      {},
      { installationContext: { ...installationContext, componentRevisions: undefined } },
    ],
    [
      'revision on both sides',
      { parts: parts.map(({ category, partId }) => ({ category, partId })) },
      { installationContext: { ...installationContext, componentRevisions: undefined } },
    ],
    [
      'BIOS on both sides',
      { installationContext: { ...installationContext, installedBiosVersion: undefined } },
      { installationContext: { ...installationContext, installedBiosVersion: undefined } },
    ],
  ])('missing %s prevents exactness', (_name, recordPatch, queryPatch) => {
    expect(classify()(record(recordPatch), { ...query, ...queryPatch })).toBe('SIMILAR');
  });

  test.each([
    ['PHYSICAL_CLEARANCE', ['radiators', 'hddCages', 'gpuOrientation']],
    ['RADIATOR_CLEARANCE', ['radiators', 'hddCages']],
    ['POWER_CONNECTOR', ['pciePower']],
    ['STORAGE_RESOURCE', ['occupiedPcieSlotIds']],
  ] as const)('%s requires each policy context field', (issueType, requiredFields) => {
    for (const field of requiredFields) {
      const context = { ...installationContext, [field]: undefined };
      const current = record({
        issueType,
        exactScope: {
          ...exactScope,
          requiredContextFields: [
            'installedBiosVersion',
            'componentRevisions',
            ...requiredFields,
          ],
        },
      });
      expect(
        classify()(current, { ...query, issueType, installationContext: context }),
      ).toBe('SIMILAR');
    }
  });

  test.each(['MEMORY_CLEARANCE', 'BIOS_POST'] as const)(
    '%s can be exact with only global revision and BIOS fields',
    (issueType) => {
      const current = record({
        issueType,
        exactScope: {
          ...exactScope,
          requiredContextFields: ['installedBiosVersion', 'componentRevisions'],
        },
      });
      expect(classify()(current, { ...query, issueType })).toBe('EXACT');
    },
  );

  test('THERMAL is never automatically exact under policy 1.0', () => {
    const current = record({
      issueType: 'THERMAL',
      exactScope: {
        ...exactScope,
        requiredContextFields: ['installedBiosVersion', 'componentRevisions'],
      },
    });
    expect(classify()(current, { ...query, issueType: 'THERMAL' })).toBe('SIMILAR');
  });

  test.each([
    ['omits a record category', { ...exactScope, requiredPartCategories: ['GPU'] }],
    ['adds an absent category', { ...exactScope, requiredPartCategories: ['GPU', 'PC_CASE', 'CPU'] }],
    [
      'removes a policy context minimum',
      {
        ...exactScope,
        requiredContextFields: exactScope.requiredContextFields.filter(
          (field) => field !== 'gpuOrientation',
        ),
      },
    ],
  ])('rejects an exact scope that %s', (_name, scope) => {
    expect(() => classify()(record({ exactScope: scope }), query)).toThrow(
      'Invalid exact evidence scope',
    );
  });
});

describe('snapshot canonicalization and immutable supersession', () => {
  const canonicalize = () =>
    exported<SnapshotValidator>('validateAndCanonicalizeFieldEvidenceSnapshot');
  const select = () => exported<ActiveSelector>('selectActiveFieldEvidence');

  test.each([
    ['duplicate IDs', [record(), record()]],
    ['dangling reference', [record({ supersedesEvidenceId: 'missing' })]],
    ['self link', [record({ supersedesEvidenceId: 'field-1' })]],
    [
      'cycle',
      [
        record({ evidenceId: 'a', supersedesEvidenceId: 'b' }),
        record({ evidenceId: 'b', supersedesEvidenceId: 'a' }),
      ],
    ],
  ])('rejects %s', (_name, records) => {
    expect(() => canonicalize()(snapshot(records))).toThrow();
  });

  test('canonicalizes reversed records, parts, scopes, and context arrays identically', () => {
    const old = record({ evidenceId: 'old' });
    const next = record({ evidenceId: 'new', supersedesEvidenceId: 'old' });
    const reversedNext = {
      ...next,
      parts: [...parts].reverse(),
      exactScope: {
        requiredPartCategories: [...exactScope.requiredPartCategories].reverse(),
        requiredContextFields: [...exactScope.requiredContextFields].reverse(),
      },
      installationContext: {
        ...installationContext,
        componentRevisions: [...installationContext.componentRevisions].reverse(),
      },
    };

    expect(canonicalize()(snapshot([old, reversedNext]))).toEqual(
      canonicalize()(snapshot([next, old])),
    );
  });

  test('derives only the approved superseding leaf as active', () => {
    expect(
      select()(snapshot([
        record({ evidenceId: 'old' }),
        record({ evidenceId: 'new', supersedesEvidenceId: 'old' }),
      ])),
    ).toMatchObject({ activeEvidenceIds: ['new'], conflicts: [] });
  });

  test.each(['DRAFT', 'REJECTED'] as const)(
    'does not let a %s successor deactivate an approved parent',
    (status) => {
      const successor = JSON.parse(JSON.stringify(record({
        evidenceId: 'new',
        status,
        supersedesEvidenceId: 'old',
        ...(status === 'DRAFT'
          ? {
              moderatedByPrincipalId: undefined,
              moderatedAt: undefined,
            }
          : {}),
      }))) as JsonRecord;
      expect(
        select()(snapshot([record({ evidenceId: 'old' }), successor])),
      ).toMatchObject({ activeEvidenceIds: ['old'], conflicts: [] });
    },
  );

  test('retains approved branch leaves and reports the supersession conflict', () => {
    expect(
      select()(snapshot([
        record({ evidenceId: 'old' }),
        record({ evidenceId: 'branch-b', supersedesEvidenceId: 'old' }),
        record({ evidenceId: 'branch-a', supersedesEvidenceId: 'old' }),
      ])),
    ).toMatchObject({
      activeEvidenceIds: ['branch-a', 'branch-b'],
      conflicts: [
        {
          supersededEvidenceId: 'old',
          successorEvidenceIds: ['branch-a', 'branch-b'],
        },
      ],
    });
  });
});

describe('legacy exact application boundary', () => {
  test('applies only approved v4 exact evidence and preserves a deterministic failure', () => {
    const apply = exported<EvidenceApplier>('applyExactFieldEvidence');
    expect(apply(unknownBase, [record()], query)).toMatchObject({
      status: 'INCOMPATIBLE',
      evidenceIds: ['field-1'],
    });
    expect(apply(unknownBase, [legacyRecord()], query)).toEqual(unknownBase);

    const deterministicFailure: RuleEvaluation = {
      status: 'INCOMPATIBLE',
      summary: 'Deterministic clearance failure',
      reasons: ['The canonical dimensions do not fit'],
      evidenceIds: [],
    };
    expect(
      apply(
        deterministicFailure,
        [record({ outcome: 'ASSEMBLY_SUCCESS' })],
        query,
      ),
    ).toEqual(deterministicFailure);
  });
});
