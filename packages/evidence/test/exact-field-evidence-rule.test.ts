import type {
  CanonicalPart,
  CompatibilityCheckInput,
  CompatibilityEngine,
  CompatibilityEngineOptions,
  EngineRule,
  InstallationContext,
} from '@pcpartcheck/core';
import { createCompatibilityEngine } from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as evidence from '../src/index.js';
import type {
  FieldEvidenceIssueType,
  FieldEvidenceRecordV4,
  FieldEvidenceSnapshot,
  MaterialContextField,
} from '../src/index.js';

const gpuId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';

const gpu: CanonicalPart = {
  schemaVersion: '3.1.0',
  partId: gpuId,
  category: 'GPU',
  manufacturer: 'Example',
  model: 'GPU',
  status: 'ACTIVE',
  spec: {},
};
const pcCase: CanonicalPart = {
  schemaVersion: '3.1.0',
  partId: caseId,
  category: 'PC_CASE',
  manufacturer: 'Example',
  model: 'Case',
  status: 'ACTIVE',
  spec: { supportedMotherboardFormFactors: ['ATX'] },
};

const installationContext: InstallationContext = {
  schemaVersion: '2.1.0',
  radiators: [],
  hddCages: [],
  gpuOrientation: 'HORIZONTAL',
  occupiedPcieSlotIds: [],
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
};

const missingGpuOrientationContext: InstallationContext = {
  schemaVersion: '2.1.0',
  radiators: [],
  hddCages: [],
  occupiedPcieSlotIds: [],
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
};

function fieldsFor(issueType: FieldEvidenceIssueType): readonly MaterialContextField[] {
  const issueFields: Readonly<
    Partial<Record<FieldEvidenceIssueType, readonly MaterialContextField[]>>
  > = {
    PHYSICAL_CLEARANCE: ['radiators', 'hddCages', 'gpuOrientation'],
    RADIATOR_CLEARANCE: ['radiators', 'hddCages'],
    POWER_CONNECTOR: ['pciePower'],
    STORAGE_RESOURCE: ['occupiedPcieSlotIds'],
  };
  return [
    ...(issueFields[issueType] ?? []),
    'installedBiosVersion',
    'componentRevisions',
  ];
}

function record(
  evidenceId: string,
  outcome: FieldEvidenceRecordV4['outcome'],
  options: {
    readonly issueType?: FieldEvidenceIssueType;
    readonly context?: InstallationContext;
    readonly gpuId?: string;
    readonly gpuRevision?: string;
    readonly supersedesEvidenceId?: string;
  } = {},
): FieldEvidenceRecordV4 {
  const issueType = options.issueType ?? 'PHYSICAL_CLEARANCE';
  const context = options.context ?? installationContext;
  return {
    schemaVersion: '4.0.0',
    evidenceId,
    status: 'APPROVED',
    visibility: 'PUBLIC',
    redaction: 'NONE',
    outcome,
    issueType,
    parts: [
      {
        category: 'GPU',
        partId: options.gpuId ?? gpuId,
        hardwareRevision: options.gpuRevision ?? 'A1',
      },
      { category: 'PC_CASE', partId: caseId, hardwareRevision: 'B2' },
    ],
    exactScope: {
      requiredPartCategories: ['GPU', 'PC_CASE'],
      requiredContextFields: [...fieldsFor(issueType)],
    },
    installationContext: context,
    ...(outcome === 'CONDITIONAL_SUCCESS'
      ? {
          conditions: [{
            code: 'MOVE_RADIATOR',
            message: 'Move the radiator before installation',
          }],
        }
      : {}),
    reportedAt: '2026-09-20T00:00:00.000Z',
    createdByPrincipalId: 'synthetic-writer',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T01:00:00.000Z',
    moderatedByPrincipalId: 'synthetic-moderator',
    moderatedAt: '2026-09-20T01:00:00.000Z',
    ...(options.supersedesEvidenceId === undefined
      ? {}
      : { supersedesEvidenceId: options.supersedesEvidenceId }),
  };
}

function fieldEvidenceSnapshot(
  records: readonly FieldEvidenceRecordV4[],
): FieldEvidenceSnapshot {
  return {
    fieldEvidenceSchemaVersion: '4.0.0',
    evidencePolicyVersion: '1.0.0',
    records,
  };
}

function exportedExactRule(): EngineRule {
  const candidate = (evidence as Readonly<Record<string, unknown>>)
    .exactFieldEvidenceRule;
  expect(candidate, 'exactFieldEvidenceRule must be exported').toBeDefined();
  return candidate as EngineRule;
}

function engine(rules: readonly EngineRule[] = [exportedExactRule()]): CompatibilityEngine {
  const options: CompatibilityEngineOptions = {
    rules,
    versions: {
      engineVersion: '0.1.0',
      ruleSetVersion: '0.1.0',
      canonicalSchemaVersion: '3.1.0',
      installationContextSchemaVersion: '2.1.0',
      knowledgeSnapshotSchemaVersion: '1.0.0',
      evidencePolicyVersion: '1.0.0',
      identityMapperVersion: '1.1.0',
      providerVersions: [],
    },
    clock: () => new Date('2026-09-20T02:00:00.000Z'),
  };
  return createCompatibilityEngine(options);
}

function input(snapshot: unknown): CompatibilityCheckInput {
  return {
    build: { schemaVersion: '3.1.0', parts: [gpu, pcCase] },
    intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
    installationContext,
    policyProfile: {
      profileId: 'exact-evidence-test',
      policyVersion: '1.0.0',
      capabilities: [{ capabilityId: 'exact-field-evidence', mode: 'REQUIRED' }],
    },
    evidenceSnapshot: snapshot as CompatibilityCheckInput['evidenceSnapshot'],
  };
}

describe('exactFieldEvidenceRule orchestration', () => {
  test.each([
    ['exact incompatible', 'ASSEMBLY_FAILURE', 'INCOMPATIBLE', 'BLOCK'],
    ['exact conditional', 'CONDITIONAL_SUCCESS', 'CONDITIONAL', 'ALLOW_IF_CONDITIONS_MET'],
    ['exact compatible', 'ASSEMBLY_SUCCESS', 'PASS', 'ALLOW'],
  ] as const)('%s', async (_name, outcome, status, decision) => {
    const result = await engine().check(
      input(fieldEvidenceSnapshot([record('evidence-1', outcome)])),
    );

    expect(result.resultSnapshot).toMatchObject({ status, decision });
    expect(result.resultSnapshot.ruleResults).toEqual([
      expect.objectContaining({
        ruleId: 'exact-field-evidence',
        capabilityId: 'exact-field-evidence',
        status,
        evidenceIds: ['evidence-1'],
      }),
    ]);
  });

  test.each([
    [
      'component mismatch',
      record('similar', 'ASSEMBLY_FAILURE', {
        gpuId: '33333333-3333-4333-8333-333333333333',
      }),
    ],
    [
      'BIOS mismatch',
      record('similar', 'ASSEMBLY_FAILURE', {
        context: { ...installationContext, installedBiosVersion: 'F11' },
      }),
    ],
    [
      'revision mismatch',
      record('similar', 'ASSEMBLY_FAILURE', {
        gpuRevision: 'A2',
        context: {
          ...installationContext,
          componentRevisions: [
            { partId: gpuId, hardwareRevision: 'A2' },
            { partId: caseId, hardwareRevision: 'B2' },
          ],
        },
      }),
    ],
    [
      'missing required context',
      record('similar', 'ASSEMBLY_FAILURE', {
        context: missingGpuOrientationContext,
      }),
    ],
  ])('%s produces no automatic result', async (_name, similar) => {
    const result = await engine().check(input(fieldEvidenceSnapshot([similar])));

    expect(result.resultSnapshot).toMatchObject({
      status: 'NOT_CHECKED',
      decision: 'NO_DECISION',
      ruleResults: [expect.objectContaining({
        status: 'NOT_CHECKED',
        evidenceIds: [],
      })],
    });
  });

  test('returns not checked for an absent or empty v4 envelope', async () => {
    const [absent, empty] = await Promise.all([
      engine().check(input({})),
      engine().check(input(fieldEvidenceSnapshot([]))),
    ]);

    expect(absent.resultSnapshot.decision).toBe('NO_DECISION');
    expect(empty.resultSnapshot.decision).toBe('NO_DECISION');
  });

  test('returns review for conflicting outcomes in one issue and exact scope', async () => {
    const result = await engine().check(input(fieldEvidenceSnapshot([
      record('failure', 'ASSEMBLY_FAILURE'),
      record('success', 'ASSEMBLY_SUCCESS'),
    ])));

    expect(result.resultSnapshot).toMatchObject({
      status: 'REVIEW_REQUIRED',
      decision: 'REVIEW',
      ruleResults: [expect.objectContaining({
        evidenceIds: ['failure', 'success'],
      })],
    });
  });

  test('returns review instead of choosing one approved supersession branch', async () => {
    const result = await engine().check(input(fieldEvidenceSnapshot([
      record('old', 'ASSEMBLY_FAILURE'),
      record('branch-a', 'ASSEMBLY_SUCCESS', { supersedesEvidenceId: 'old' }),
      record('branch-b', 'ASSEMBLY_SUCCESS', { supersedesEvidenceId: 'old' }),
    ])));

    expect(result.resultSnapshot).toMatchObject({
      status: 'REVIEW_REQUIRED',
      decision: 'REVIEW',
      ruleResults: [expect.objectContaining({
        evidenceIds: ['branch-a', 'branch-b'],
      })],
    });
  });

  test('does not turn different outcomes in independent issue groups into a conflict', async () => {
    const result = await engine().check(input(fieldEvidenceSnapshot([
      record('bios-success', 'ASSEMBLY_SUCCESS', { issueType: 'BIOS_POST' }),
      record('clearance-failure', 'ASSEMBLY_FAILURE'),
    ])));

    expect(result.resultSnapshot).toMatchObject({
      status: 'INCOMPATIBLE',
      decision: 'BLOCK',
      ruleResults: [expect.objectContaining({
        status: 'INCOMPATIBLE',
        evidenceIds: ['clearance-failure'],
      })],
    });
  });

  test('does not let exact success override a deterministic required failure', async () => {
    const deterministicFailure: EngineRule = {
      ruleId: 'psu-form-factor',
      capabilityId: 'psu-form-factor',
      evaluate: () => ({
        status: 'INCOMPATIBLE',
        summary: 'Case does not support the PSU form factor',
        reasons: ['ATX is not supported'],
        evidenceIds: [],
      }),
    };
    const result = await engine([exportedExactRule(), deterministicFailure]).check({
      ...input(fieldEvidenceSnapshot([record('success', 'ASSEMBLY_SUCCESS')])),
      policyProfile: {
        profileId: 'combined',
        policyVersion: '1.0.0',
        capabilities: [
          { capabilityId: 'exact-field-evidence', mode: 'REQUIRED' },
          { capabilityId: 'psu-form-factor', mode: 'REQUIRED' },
        ],
      },
    });

    expect(result.resultSnapshot).toMatchObject({
      status: 'INCOMPATIBLE',
      decision: 'BLOCK',
      issues: { blockingRuleIds: ['psu-form-factor'] },
    });
  });
});
