import type {
  BiosRequirement,
  CompatibilityRuleContext,
  EngineRule,
  KnowledgeSnapshot,
} from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as rules from '../src/index.js';
import {
  context,
  cpu,
  installationContext,
  motherboard,
} from './fixtures.js';

type CpuSupportResolver = (context: CompatibilityRuleContext) => unknown;

interface KnowledgeOptions {
  readonly suffix: string;
  readonly providerId: string;
  readonly support?: 'SUPPORTED' | 'UNSUPPORTED';
  readonly biosRequirementKind?: BiosRequirement['kind'];
  readonly subjectRevision?: string;
  readonly relatedRevision?: string;
  readonly supersedesSnapshotId?: string;
  readonly relatedPartId?: string;
}

function exportedRule(): EngineRule {
  const candidate = (rules as Readonly<Record<string, unknown>>).cpuSupportRule;
  expect(candidate, 'cpuSupportRule must be exported').toBeDefined();
  return candidate as EngineRule;
}

function exportedResolver(): CpuSupportResolver {
  const candidate = (rules as Readonly<Record<string, unknown>>)
    .resolveCpuSupport;
  expect(candidate, 'resolveCpuSupport must be exported').toBeTypeOf('function');
  return candidate as CpuSupportResolver;
}

function knowledge({
  suffix,
  providerId,
  support,
  biosRequirementKind = 'NONE',
  subjectRevision,
  relatedRevision,
  supersedesSnapshotId,
  relatedPartId = cpu().partId,
}: KnowledgeOptions): KnowledgeSnapshot {
  const snapshotId = `snapshot-${suffix}`;
  const sourceId = `source-${suffix}`;
  const supportRelationId = `support-${suffix}`;
  const biosReleaseId = `bios-${suffix}`;
  const subject = {
    partId: motherboard().partId,
    category: 'MOTHERBOARD' as const,
    ...(subjectRevision === undefined
      ? {}
      : { hardwareRevision: subjectRevision }),
  };
  const related = {
    partId: relatedPartId,
    category: 'CPU' as const,
    ...(relatedRevision === undefined
      ? {}
      : { hardwareRevision: relatedRevision }),
  };
  const sources =
    support === undefined
      ? []
      : [
          {
            sourceId,
            sourceUri: `https://example.invalid/knowledge/${suffix}`,
            capturedAt: '2026-09-20T00:00:00.000Z',
            evidenceIds: [],
          },
        ];
  let relations: KnowledgeSnapshot['relations'] = [];
  if (support === 'UNSUPPORTED') {
    relations = [
      {
        relationId: supportRelationId,
        relationType: 'CPU_SUPPORT',
        subject,
        related,
        support: 'UNSUPPORTED',
        sourceIds: [sourceId],
      },
    ];
  } else if (support === 'SUPPORTED') {
    relations = [
      {
        relationId: supportRelationId,
        relationType: 'CPU_SUPPORT',
        subject,
        related,
        support: 'SUPPORTED',
        biosRequirement:
          biosRequirementKind === 'MINIMUM'
            ? { kind: 'MINIMUM', biosReleaseId }
            : { kind: biosRequirementKind },
        sourceIds: [sourceId],
      },
      ...(biosRequirementKind === 'MINIMUM'
        ? [
            {
              relationId: biosReleaseId,
              relationType: 'BIOS_RELEASE' as const,
              subject,
              biosVersion: 'F12',
              releaseOrdinal: 12,
              sourceIds: [sourceId],
            },
          ]
        : []),
    ];
  }

  return {
    schemaVersion: '1.0.0',
    snapshotId,
    ...(supersedesSnapshotId === undefined ? {} : { supersedesSnapshotId }),
    provider: { providerId, providerVersion: `version-${suffix}` },
    collectedAt: '2026-09-20T00:00:00.000Z',
    sources,
    relations,
  };
}

function ruleContext(
  knowledgeSnapshots: readonly KnowledgeSnapshot[],
  componentRevisions?: CompatibilityRuleContext['installationContext']['componentRevisions'],
): CompatibilityRuleContext {
  return {
    ...context(
      [cpu(), motherboard()],
      'cpu-support',
      undefined,
      {
        ...installationContext,
        ...(componentRevisions === undefined ? {} : { componentRevisions }),
      },
    ),
    knowledgeSnapshots,
  };
}

describe('cpuSupportRule', () => {
  test.each([
    [
      'exact supported CPU',
      [knowledge({ suffix: 'supported', providerId: 'provider-a', support: 'SUPPORTED' })],
      'PASS',
    ],
    [
      'explicit unsupported CPU',
      [knowledge({ suffix: 'unsupported', providerId: 'provider-a', support: 'UNSUPPORTED' })],
      'INCOMPATIBLE',
    ],
    ['support list unavailable', [], 'UNKNOWN'],
    [
      'conflicting active providers',
      [
        knowledge({ suffix: 'conflict-a', providerId: 'provider-a', support: 'SUPPORTED' }),
        knowledge({ suffix: 'conflict-b', providerId: 'provider-b', support: 'UNSUPPORTED' }),
      ],
      'REVIEW_REQUIRED',
    ],
  ] as const)('%s', async (_name, knowledgeSnapshots, status) => {
    expect(
      await exportedRule().evaluate(ruleContext(knowledgeSnapshots)),
    ).toMatchObject({ status });
  });

  test.each([
    ['exact revision applies', 'rev-a', 'PASS'],
    ['required revision is absent', undefined, 'UNKNOWN'],
    ['different revision does not apply', 'rev-b', 'UNKNOWN'],
  ] as const)('%s', async (_name, hardwareRevision, status) => {
    const componentRevisions =
      hardwareRevision === undefined
        ? undefined
        : [{ partId: motherboard().partId, hardwareRevision }];
    const result = await exportedRule().evaluate(
      ruleContext(
        [
          knowledge({
            suffix: `revision-${hardwareRevision ?? 'missing'}`,
            providerId: 'provider-a',
            support: 'SUPPORTED',
            subjectRevision: 'rev-a',
          }),
        ],
        componentRevisions,
      ),
    );

    expect(result.status).toBe(status);
  });

  test('does not infer unsupported from an unrelated or incomplete provider', async () => {
    const result = await exportedRule().evaluate(
      ruleContext([
        knowledge({ suffix: 'supported-a', providerId: 'provider-a', support: 'SUPPORTED' }),
        knowledge({ suffix: 'missing-b', providerId: 'provider-b' }),
        knowledge({
          suffix: 'other-cpu',
          providerId: 'provider-c',
          support: 'UNSUPPORTED',
          relatedPartId: '99999999-9999-4999-8999-999999999999',
        }),
      ]),
    );

    expect(result).toMatchObject({
      status: 'PASS',
      knowledgeRelationIds: ['support-supported-a'],
    });
  });

  test('uses only the active supersession leaf', async () => {
    const stale = knowledge({
      suffix: 'stale',
      providerId: 'provider-a',
      support: 'UNSUPPORTED',
    });
    const current = knowledge({
      suffix: 'current',
      providerId: 'provider-a',
      support: 'SUPPORTED',
      supersedesSnapshotId: stale.snapshotId,
    });

    expect(
      await exportedRule().evaluate(ruleContext([current, stale])),
    ).toMatchObject({
      status: 'PASS',
      knowledgeRelationIds: ['support-current'],
    });
  });

  test('does not choose between conflicting active leaves from one provider', async () => {
    const result = await exportedRule().evaluate(
      ruleContext([
        knowledge({ suffix: 'branch-a', providerId: 'provider-a', support: 'SUPPORTED' }),
        knowledge({ suffix: 'branch-b', providerId: 'provider-a', support: 'UNSUPPORTED' }),
      ]),
    );

    expect(result).toMatchObject({
      status: 'REVIEW_REQUIRED',
      knowledgeRelationIds: ['support-branch-a', 'support-branch-b'],
    });
  });
});

describe('resolveCpuSupport', () => {
  test('preserves minimum BIOS provenance without comparing BIOS versions', () => {
    const knowledgeSnapshot = knowledge({
      suffix: 'minimum',
      providerId: 'provider-a',
      support: 'SUPPORTED',
      biosRequirementKind: 'MINIMUM',
    });

    expect(exportedResolver()(ruleContext([knowledgeSnapshot]))).toEqual({
      kind: 'SUPPORTED',
      relationIds: ['support-minimum'],
      observations: [
        {
          providerId: 'provider-a',
          snapshotId: 'snapshot-minimum',
          supportRelationId: 'support-minimum',
          biosRequirement: {
            kind: 'MINIMUM',
            biosReleaseId: 'bios-minimum',
            biosVersion: 'F12',
          },
        },
      ],
    });
  });

  test('is deterministic and does not mutate Knowledge input', () => {
    const first = knowledge({
      suffix: 'z',
      providerId: 'provider-z',
      support: 'SUPPORTED',
      biosRequirementKind: 'UNKNOWN',
    });
    const second = knowledge({
      suffix: 'a',
      providerId: 'provider-a',
      support: 'SUPPORTED',
    });
    const original = structuredClone([first, second]);

    const forward = exportedResolver()(ruleContext([first, second]));
    const reversed = exportedResolver()(ruleContext([second, first]));

    expect(forward).toEqual(reversed);
    expect([first, second]).toEqual(original);
  });
});
