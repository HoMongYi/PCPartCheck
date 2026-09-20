import { expect, test } from 'vitest';

import * as core from '../src/index.js';
import type {
  CompatibilityCheckInput,
  CompatibilityEngine,
  CompatibilityEngineOptions,
  EngineRule,
  InstallationContext,
  KnowledgeSnapshot,
  PolicyProfile,
} from '../src/index.js';

const cpu = {
  schemaVersion: '3.1.0',
  partId: '11111111-1111-4111-8111-111111111111',
  category: 'CPU',
  manufacturer: 'Example',
  model: 'Eight Core',
  status: 'ACTIVE',
  spec: { socket: 'AM5', coreCount: 8, threadCount: 16 },
} as const;

const installationContext: InstallationContext = {
  schemaVersion: '2.1.0',
  radiators: [],
  hddCages: [],
  gpuOrientation: 'HORIZONTAL',
  occupiedPcieSlotIds: [],
  pciePower: {
    independentCableCount: 0,
    native12VhpwrCableCount: 0,
    native12V2x6CableCount: 0,
    adapterUsed: false,
  },
};

const knowledgeSnapshot: KnowledgeSnapshot = {
  schemaVersion: '1.0.0',
  snapshotId: 'snapshot-b',
  provider: {
    providerId: 'synthetic-manufacturer',
    providerVersion: '2',
  },
  collectedAt: '2026-09-20T00:00:00.000Z',
  sources: [
    {
      sourceId: 'source-a',
      sourceUri: 'https://example.invalid/knowledge/board-a',
      capturedAt: '2026-09-20T00:00:00.000Z',
      evidenceIds: [],
    },
  ],
  relations: [
    {
      relationId: 'support-a',
      relationType: 'CPU_SUPPORT',
      subject: {
        partId: '22222222-2222-4222-8222-222222222222',
        category: 'MOTHERBOARD',
      },
      related: {
        partId: cpu.partId,
        category: 'CPU',
      },
      support: 'SUPPORTED',
      biosRequirement: { kind: 'NONE' },
      sourceIds: ['source-a'],
    },
  ],
};

const emptyKnowledgeSnapshot: KnowledgeSnapshot = {
  schemaVersion: '1.0.0',
  snapshotId: 'snapshot-a',
  provider: {
    providerId: 'synthetic-manufacturer',
    providerVersion: '1',
  },
  collectedAt: '2026-09-19T00:00:00.000Z',
  sources: [],
  relations: [],
};

function createEngine(
  rules: CompatibilityEngineOptions['rules'],
): CompatibilityEngine {
  const factory = (core as Readonly<Record<string, unknown>>)
    .createCompatibilityEngine;
  expect(factory).toBeTypeOf('function');
  return (
    factory as (options: CompatibilityEngineOptions) => CompatibilityEngine
  )({
    rules,
    versions: {
      engineVersion: '0.1.0',
      ruleSetVersion: '0.1.0',
      canonicalSchemaVersion: '3.1.0',
      installationContextSchemaVersion: '2.1.0',
      knowledgeSnapshotSchemaVersion: '1.0.0',
      evidencePolicyVersion: '1.0.0',
      identityMapperVersion: '0.1.0',
      providerVersions: [
        {
          providerId: 'buildcores-open-db',
          providerVersion: 'snapshot-2026-09-06',
          commitSha: 'ce2e22b85a3b9a5ee10c28fd8a457b9b536eeff1',
          schemaFingerprint: 'sha256:fixture',
        },
      ],
    },
    clock: () => new Date('2026-09-08T00:00:00.000Z'),
  });
}

function input(
  capabilities: PolicyProfile['capabilities'],
  knowledgeSnapshots?: readonly KnowledgeSnapshot[],
): CompatibilityCheckInput {
  return {
    build: { schemaVersion: '3.1.0', parts: [cpu] },
    intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
    installationContext,
    policyProfile: {
      profileId: 'new-build',
      policyVersion: '1.0.0',
      capabilities,
    },
    ...(knowledgeSnapshots === undefined ? {} : { knowledgeSnapshots }),
    evidenceSnapshot: {
      evidenceVersion: '1.0.0',
      evidenceIds: ['raw-cpu-socket'],
    },
  };
}

test('disabled capability is not evaluated and is recorded as not checked', async () => {
  let evaluated = false;
  const evaluate: EngineRule['evaluate'] = () => {
    evaluated = true;
    return {
      status: 'PASS',
      summary: 'must not run',
      reasons: [],
      evidenceIds: [],
    };
  };
  const engine = createEngine([
    { ruleId: 'bios', capabilityId: 'bios', evaluate },
  ]);

  const snapshot = await engine.check(
    input([{ capabilityId: 'bios', mode: 'DISABLED' }]),
  );

  expect(evaluated).toBe(false);
  expect(snapshot.resultSnapshot).toMatchObject({
    status: 'NOT_CHECKED',
    decision: 'NO_DECISION',
    ruleResults: [
      { ruleId: 'bios', policyMode: 'DISABLED', status: 'NOT_CHECKED' },
    ],
  });
});

test('rules run in ruleId order and preserve advisory incompatibility', async () => {
  const calls: string[] = [];
  const engine = createEngine([
    {
      ruleId: 'z-rgb',
      capabilityId: 'rgb',
      evaluate: () => {
        calls.push('z-rgb');
        return {
          status: 'INCOMPATIBLE',
          summary: 'header mismatch',
          reasons: ['5V and 12V differ'],
          evidenceIds: [],
        };
      },
    },
    {
      ruleId: 'a-socket',
      capabilityId: 'socket',
      evaluate: () => {
        calls.push('a-socket');
        return {
          status: 'PASS',
          summary: 'socket matches',
          reasons: [],
          evidenceIds: ['raw-cpu-socket'],
        };
      },
    },
  ]);

  const snapshot = await engine.check(
    input([
      { capabilityId: 'socket', mode: 'REQUIRED' },
      { capabilityId: 'rgb', mode: 'ADVISORY' },
    ]),
  );

  expect(calls).toEqual(['a-socket', 'z-rgb']);
  expect(snapshot.resultSnapshot).toMatchObject({
    status: 'INCOMPATIBLE',
    decision: 'ALLOW_WITH_WARNING',
  });
});

test('rule receives its resolved capability policy and config', async () => {
  let receivedPolicy: unknown;
  const engine = createEngine([
    {
      ruleId: 'gpu-clearance',
      capabilityId: 'gpu-clearance',
      evaluate: (context) => {
        receivedPolicy = (
          context as unknown as Readonly<Record<string, unknown>>
        ).policy;
        return {
          status: 'PASS',
          summary: 'clearance matches',
          reasons: [],
          evidenceIds: [],
        };
      },
    },
  ]);

  await engine.check(
    input([
      {
        capabilityId: 'gpu-clearance',
        mode: 'REQUIRED',
        config: { safetyMarginMm: 10 },
      },
    ]),
  );

  expect(receivedPolicy).toEqual({
    capabilityId: 'gpu-clearance',
    mode: 'REQUIRED',
    config: { safetyMarginMm: 10 },
  });
});

test('normalizes omitted knowledge to immutable rule and replay inputs', async () => {
  let receivedKnowledge: readonly KnowledgeSnapshot[] | undefined;
  let receivedEvidence: unknown;
  const engine = createEngine([
    {
      ruleId: 'socket',
      capabilityId: 'socket',
      evaluate: (context) => {
        receivedKnowledge = context.knowledgeSnapshots;
        receivedEvidence = context.evidenceSnapshot;
        return {
          status: 'PASS',
          summary: 'socket matches',
          reasons: [],
          evidenceIds: [],
        };
      },
    },
  ]);
  const checkInput = input([{ capabilityId: 'socket', mode: 'REQUIRED' }]);

  const snapshot = await engine.check(checkInput);

  expect(receivedKnowledge).toEqual([]);
  expect(snapshot.inputSnapshot.knowledgeSnapshots).toEqual([]);
  expect(receivedKnowledge).toBe(snapshot.inputSnapshot.knowledgeSnapshots);
  expect(receivedEvidence).toEqual(checkInput.evidenceSnapshot);
  expect(receivedEvidence).not.toBe(checkInput.evidenceSnapshot);
  expect(receivedEvidence).toBe(snapshot.evidenceSnapshot);
});

test('canonicalizes Knowledge once for deterministic rules and replay', async () => {
  const engine = createEngine([
    {
      ruleId: 'knowledge-observer',
      capabilityId: 'knowledge-observer',
      evaluate: (context) => ({
        status: 'PASS',
        summary: 'knowledge observed',
        reasons: context.knowledgeSnapshots.map(({ snapshotId }) => snapshotId),
        evidenceIds: [],
        knowledgeRelationIds: context.knowledgeSnapshots.flatMap(({ relations }) =>
          relations.map(({ relationId }) => relationId),
        ),
      }),
    },
  ]);
  const capabilities = [
    { capabilityId: 'knowledge-observer', mode: 'REQUIRED' as const },
  ];

  const forward = await engine.check(
    input(capabilities, [knowledgeSnapshot, emptyKnowledgeSnapshot]),
  );
  const reversed = await engine.check(
    input(capabilities, [emptyKnowledgeSnapshot, knowledgeSnapshot]),
  );

  expect(forward).toEqual(reversed);
  expect(
    forward.inputSnapshot.knowledgeSnapshots.map(({ snapshotId }) => snapshotId),
  ).toEqual(['snapshot-a', 'snapshot-b']);
  expect(forward.resultSnapshot.ruleResults[0]).toMatchObject({
    knowledgeRelationIds: ['support-a'],
    reasons: ['snapshot-a', 'snapshot-b'],
  });
  await expect(engine.replay(forward)).resolves.toEqual(forward);
});

test('snapshot captures every version and immutable audit input', async () => {
  const engine = createEngine([
    {
      ruleId: 'socket',
      capabilityId: 'socket',
      evaluate: () => ({
        status: 'PASS',
        summary: 'socket matches',
        reasons: [],
        evidenceIds: ['raw-cpu-socket'],
      }),
    },
  ]);
  const checkInput = input([{ capabilityId: 'socket', mode: 'REQUIRED' }]);

  const snapshot = await engine.check(checkInput);

  expect(snapshot).toMatchObject({
    snapshotFormatVersion: '3.0.0',
    checkedAt: '2026-09-08T00:00:00.000Z',
    engineVersion: '0.1.0',
    ruleSetVersion: '0.1.0',
    policyVersion: '1.0.0',
    canonicalSchemaVersion: '3.1.0',
    installationContextSchemaVersion: '2.1.0',
    knowledgeSnapshotSchemaVersion: '1.0.0',
    evidencePolicyVersion: '1.0.0',
    identityMapperVersion: '0.1.0',
    providerVersions: [
      {
        providerId: 'buildcores-open-db',
        commitSha: 'ce2e22b85a3b9a5ee10c28fd8a457b9b536eeff1',
      },
    ],
    inputSnapshot: {
      build: checkInput.build,
      intent: checkInput.intent,
      installationContext: checkInput.installationContext,
      policyProfile: checkInput.policyProfile,
      knowledgeSnapshots: [],
    },
    evidenceSnapshot: checkInput.evidenceSnapshot,
  });
  expect(snapshot.resultSnapshot.ruleResults).toHaveLength(1);
  expect(snapshot.inputSnapshot.build).not.toBe(checkInput.build);
});

test('replay reproduces a matching snapshot and rejects version drift', async () => {
  const engine = createEngine([
    {
      ruleId: 'socket',
      capabilityId: 'socket',
      evaluate: () => ({
        status: 'PASS',
        summary: 'socket matches',
        reasons: [],
        evidenceIds: [],
      }),
    },
  ]);
  const snapshot = await engine.check(
    input([{ capabilityId: 'socket', mode: 'REQUIRED' }]),
  );

  await expect(engine.replay(snapshot)).resolves.toEqual(snapshot);
  await expect(
    engine.replay({ ...snapshot, engineVersion: '0.0.9' }),
  ).rejects.toThrow('Replay version mismatch for engineVersion');
  await expect(
    engine.replay({ ...snapshot, canonicalSchemaVersion: '1.1.0' }),
  ).rejects.toMatchObject({
    name: 'ReplayVersionMismatchError',
    field: 'canonicalSchemaVersion',
  });
  await expect(
    engine.replay({
      ...snapshot,
      knowledgeSnapshotSchemaVersion: '0.9.0',
    }),
  ).rejects.toMatchObject({
    name: 'ReplayVersionMismatchError',
    field: 'knowledgeSnapshotSchemaVersion',
  });
  await expect(
    engine.replay({ ...snapshot, evidencePolicyVersion: '0.9.0' }),
  ).rejects.toMatchObject({
    name: 'ReplayVersionMismatchError',
    field: 'evidencePolicyVersion',
  });
  await expect(
    engine.replay({
      ...snapshot,
      snapshotFormatVersion: '2.0.0',
    } as unknown as typeof snapshot),
  ).rejects.toMatchObject({
    name: 'ReplayVersionMismatchError',
    field: 'snapshotFormatVersion',
  });
  await expect(
    engine.replay({
      ...snapshot,
      installationContextSchemaVersion: '1.0.0',
      inputSnapshot: {
        ...snapshot.inputSnapshot,
        installationContext: {
          ...snapshot.inputSnapshot.installationContext,
          schemaVersion: '1.0.0',
        },
      },
    } as unknown as typeof snapshot),
  ).rejects.toMatchObject({
    name: 'ReplayVersionMismatchError',
    field: 'installationContextSchemaVersion',
  });
});

test('invalid canonical input is rejected instead of becoming pass', async () => {
  const engine = createEngine([]);
  const checkInput = input([]);

  await expect(
    engine.check(
      {
        ...checkInput,
        build: {
          schemaVersion: '3.1.0',
          parts: [{ ...cpu, spec: { rawProviderSocket: 'AM5' } }],
        },
      } as unknown as CompatibilityCheckInput,
    ),
  ).rejects.toThrow('Invalid canonical build input');
});

test('installation context rejects duplicate component revision identities', async () => {
  const engine = createEngine([]);
  const checkInput = input([]);
  const duplicatePartId = '22222222-2222-4222-8222-222222222222';

  await expect(
    engine.check({
      ...checkInput,
      installationContext: {
        ...checkInput.installationContext,
        componentRevisions: [
          { partId: duplicatePartId, hardwareRevision: '1.0' },
          { partId: duplicatePartId, hardwareRevision: '1.1' },
        ],
      },
    }),
  ).rejects.toThrow('Duplicate component revision partId');
});
