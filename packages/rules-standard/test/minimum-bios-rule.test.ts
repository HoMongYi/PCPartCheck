import type {
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

type BiosRequirementResolver = (
  context: CompatibilityRuleContext,
) => unknown;

interface BiosReleaseFixture {
  readonly biosVersion: string;
  readonly releaseOrdinal: number;
  readonly hardwareRevision?: string;
}

interface KnowledgeOptions {
  readonly suffix: string;
  readonly providerId: string;
  readonly support?: 'SUPPORTED' | 'UNSUPPORTED';
  readonly requirement?:
    | { readonly kind: 'NONE' }
    | { readonly kind: 'UNKNOWN' }
    | {
        readonly kind: 'MINIMUM';
        readonly biosVersion: string;
        readonly releaseOrdinal: number;
      };
  readonly releases?: readonly BiosReleaseFixture[];
  readonly subjectRevision?: string;
}

function exportedRule(): EngineRule {
  const candidate = (rules as Readonly<Record<string, unknown>>)
    .minimumBiosRule;
  expect(candidate, 'minimumBiosRule must be exported').toBeDefined();
  return candidate as EngineRule;
}

function exportedResolver(): BiosRequirementResolver {
  const candidate = (rules as Readonly<Record<string, unknown>>)
    .resolveBiosRequirement;
  expect(candidate, 'resolveBiosRequirement must be exported').toBeTypeOf(
    'function',
  );
  return candidate as BiosRequirementResolver;
}

function knowledge({
  suffix,
  providerId,
  support,
  requirement = { kind: 'NONE' },
  releases = [],
  subjectRevision,
}: KnowledgeOptions): KnowledgeSnapshot {
  const snapshotId = `snapshot-${suffix}`;
  const sourceId = `source-${suffix}`;
  const supportRelationId = `support-${suffix}`;
  const minimumReleaseId = `minimum-${suffix}`;
  const subject = {
    partId: motherboard().partId,
    category: 'MOTHERBOARD' as const,
    ...(subjectRevision === undefined
      ? {}
      : { hardwareRevision: subjectRevision }),
  };
  const related = {
    partId: cpu().partId,
    category: 'CPU' as const,
  };
  const hasRelations = support !== undefined || releases.length > 0;
  const biosReleases: KnowledgeSnapshot['relations'] = [
    ...(requirement.kind === 'MINIMUM'
      ? [
          {
            relationId: minimumReleaseId,
            relationType: 'BIOS_RELEASE' as const,
            subject,
            biosVersion: requirement.biosVersion,
            releaseOrdinal: requirement.releaseOrdinal,
            sourceIds: [sourceId],
          },
        ]
      : []),
    ...releases.map((release, index) => ({
      relationId: `release-${suffix}-${index}`,
      relationType: 'BIOS_RELEASE' as const,
      subject: {
        partId: motherboard().partId,
        category: 'MOTHERBOARD' as const,
        ...(release.hardwareRevision === undefined
          ? subjectRevision === undefined
            ? {}
            : { hardwareRevision: subjectRevision }
          : { hardwareRevision: release.hardwareRevision }),
      },
      biosVersion: release.biosVersion,
      releaseOrdinal: release.releaseOrdinal,
      sourceIds: [sourceId],
    })),
  ];
  let supportRelations: KnowledgeSnapshot['relations'] = [];
  if (support === 'UNSUPPORTED') {
    supportRelations = [
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
    supportRelations = [
      {
        relationId: supportRelationId,
        relationType: 'CPU_SUPPORT',
        subject,
        related,
        support: 'SUPPORTED',
        biosRequirement:
          requirement.kind === 'MINIMUM'
            ? { kind: 'MINIMUM', biosReleaseId: minimumReleaseId }
            : requirement,
        sourceIds: [sourceId],
      },
    ];
  }

  return {
    schemaVersion: '1.0.0',
    snapshotId,
    provider: { providerId, providerVersion: `version-${suffix}` },
    collectedAt: '2026-09-20T00:00:00.000Z',
    sources: hasRelations
      ? [
          {
            sourceId,
            sourceUri: `https://example.invalid/knowledge/${suffix}`,
            capturedAt: '2026-09-20T00:00:00.000Z',
            evidenceIds: [],
          },
        ]
      : [],
    relations: [...supportRelations, ...biosReleases],
  };
}

function ruleContext(
  knowledgeSnapshots: readonly KnowledgeSnapshot[],
  installedBiosVersion?: string,
  componentRevisions?: CompatibilityRuleContext['installationContext']['componentRevisions'],
): CompatibilityRuleContext {
  return {
    ...context(
      [cpu(), motherboard()],
      'bios',
      undefined,
      {
        ...installationContext,
        ...(installedBiosVersion === undefined
          ? {}
          : { installedBiosVersion }),
        ...(componentRevisions === undefined ? {} : { componentRevisions }),
      },
    ),
    knowledgeSnapshots,
  };
}

function minimumKnowledge(
  suffix: string,
  installedRelease?: BiosReleaseFixture,
): KnowledgeSnapshot {
  return knowledge({
    suffix,
    providerId: `provider-${suffix}`,
    support: 'SUPPORTED',
    requirement: {
      kind: 'MINIMUM',
      biosVersion: 'F12',
      releaseOrdinal: 12,
    },
    releases: installedRelease === undefined ? [] : [installedRelease],
  });
}

describe('minimumBiosRule', () => {
  test('exports the planned rule identity', () => {
    expect(exportedRule()).toMatchObject({
      ruleId: 'minimum-bios',
      capabilityId: 'bios',
    });
  });

  test.each([
    [
      'minimum BIOS satisfied',
      'F12',
      minimumKnowledge('satisfied'),
      'PASS',
    ],
    [
      'minimum BIOS insufficient',
      'F10',
      minimumKnowledge('insufficient', {
        biosVersion: 'F10',
        releaseOrdinal: 10,
      }),
      'INCOMPATIBLE',
    ],
    [
      'current BIOS unknown',
      undefined,
      minimumKnowledge('current-unknown'),
      'UNKNOWN',
    ],
    [
      'installed string not in release history',
      'F11-beta',
      minimumKnowledge('unmapped'),
      'REVIEW_REQUIRED',
    ],
  ] as const)(
    '%s',
    async (_name, installedBiosVersion, knowledgeSnapshot, status) => {
      expect(
        await exportedRule().evaluate(
          ruleContext([knowledgeSnapshot], installedBiosVersion),
        ),
      ).toMatchObject({ status });
    },
  );

  test.each([
    ['support list unavailable', [], undefined, 'UNKNOWN'],
    [
      'unsupported CPU',
      [
        knowledge({
          suffix: 'unsupported',
          providerId: 'provider-a',
          support: 'UNSUPPORTED',
        }),
      ],
      'F99',
      'NOT_CHECKED',
    ],
    [
      'explicit no-minimum',
      [
        knowledge({
          suffix: 'none',
          providerId: 'provider-a',
          support: 'SUPPORTED',
          requirement: { kind: 'NONE' },
        }),
      ],
      undefined,
      'PASS',
    ],
    [
      'unknown requirement',
      [
        knowledge({
          suffix: 'unknown',
          providerId: 'provider-a',
          support: 'SUPPORTED',
          requirement: { kind: 'UNKNOWN' },
        }),
      ],
      'F99',
      'UNKNOWN',
    ],
  ] as const)(
    '%s',
    async (_name, knowledgeSnapshots, installedBiosVersion, status) => {
      expect(
        await exportedRule().evaluate(
          ruleContext(knowledgeSnapshots, installedBiosVersion),
        ),
      ).toMatchObject({ status });
    },
  );

  test('rejects duplicate installed BIOS mappings with different ordinals', async () => {
    const result = await exportedRule().evaluate(
      ruleContext(
        [
          knowledge({
            suffix: 'duplicate',
            providerId: 'provider-a',
            support: 'SUPPORTED',
            requirement: {
              kind: 'MINIMUM',
              biosVersion: 'F12',
              releaseOrdinal: 12,
            },
            releases: [
              { biosVersion: 'F10', releaseOrdinal: 9 },
              { biosVersion: 'F10', releaseOrdinal: 10 },
            ],
          }),
        ],
        'F10',
      ),
    );

    expect(result).toMatchObject({
      status: 'REVIEW_REQUIRED',
      knowledgeRelationIds: [
        'minimum-duplicate',
        'release-duplicate-0',
        'release-duplicate-1',
        'support-duplicate',
      ],
    });
  });

  test('agrees across providers with different relation IDs for the same minimum version', async () => {
    const first = minimumKnowledge('agreement-a');
    const second = knowledge({
      suffix: 'agreement-b',
      providerId: 'provider-b',
      support: 'SUPPORTED',
      requirement: {
        kind: 'MINIMUM',
        biosVersion: 'F12',
        releaseOrdinal: 120,
      },
    });

    expect(
      await exportedRule().evaluate(ruleContext([second, first], 'F12')),
    ).toMatchObject({
      status: 'PASS',
      knowledgeRelationIds: [
        'minimum-agreement-a',
        'minimum-agreement-b',
        'support-agreement-a',
        'support-agreement-b',
      ],
    });
  });

  test('requires review when providers require different minimum versions', async () => {
    const first = minimumKnowledge('different-a');
    const second = knowledge({
      suffix: 'different-b',
      providerId: 'provider-b',
      support: 'SUPPORTED',
      requirement: {
        kind: 'MINIMUM',
        biosVersion: 'F13',
        releaseOrdinal: 13,
      },
      releases: [{ biosVersion: 'F12', releaseOrdinal: 12 }],
    });

    expect(
      await exportedRule().evaluate(ruleContext([first, second], 'F12')),
    ).toMatchObject({ status: 'REVIEW_REQUIRED' });
  });

  test('requires review when provider ordinal comparisons disagree', async () => {
    const insufficient = knowledge({
      suffix: 'comparison-a',
      providerId: 'provider-a',
      support: 'SUPPORTED',
      requirement: {
        kind: 'MINIMUM',
        biosVersion: 'F12',
        releaseOrdinal: 12,
      },
      releases: [{ biosVersion: 'F10', releaseOrdinal: 10 }],
    });
    const satisfied = knowledge({
      suffix: 'comparison-b',
      providerId: 'provider-b',
      support: 'SUPPORTED',
      requirement: {
        kind: 'MINIMUM',
        biosVersion: 'F12',
        releaseOrdinal: 8,
      },
      releases: [{ biosVersion: 'F10', releaseOrdinal: 10 }],
    });

    expect(
      await exportedRule().evaluate(
        ruleContext([insufficient, satisfied], 'F10'),
      ),
    ).toMatchObject({ status: 'REVIEW_REQUIRED' });
  });

  test('uses releaseOrdinal rather than lexical BIOS version ordering', async () => {
    const result = await exportedRule().evaluate(
      ruleContext(
        [
          knowledge({
            suffix: 'ordinal',
            providerId: 'provider-a',
            support: 'SUPPORTED',
            requirement: {
              kind: 'MINIMUM',
              biosVersion: 'F10',
              releaseOrdinal: 10,
            },
            releases: [{ biosVersion: 'F9', releaseOrdinal: 9 }],
          }),
        ],
        'F9',
      ),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test.each([
    ['exact revision applies', 'rev-a', 'PASS'],
    ['required revision is absent', undefined, 'UNKNOWN'],
    ['different revision does not apply', 'rev-b', 'UNKNOWN'],
  ] as const)('%s', async (_name, hardwareRevision, status) => {
    const result = await exportedRule().evaluate(
      ruleContext(
        [
          knowledge({
            suffix: `revision-${hardwareRevision ?? 'missing'}`,
            providerId: 'provider-a',
            support: 'SUPPORTED',
            requirement: { kind: 'NONE' },
            subjectRevision: 'rev-a',
          }),
        ],
        undefined,
        hardwareRevision === undefined
          ? undefined
          : [{ partId: motherboard().partId, hardwareRevision }],
      ),
    );

    expect(result.status).toBe(status);
  });

  test('maps CPU support conflict to review without evaluating BIOS', async () => {
    const result = await exportedRule().evaluate(
      ruleContext(
        [
          knowledge({
            suffix: 'support-conflict-a',
            providerId: 'provider-a',
            support: 'SUPPORTED',
            requirement: { kind: 'NONE' },
          }),
          knowledge({
            suffix: 'support-conflict-b',
            providerId: 'provider-b',
            support: 'UNSUPPORTED',
          }),
        ],
        'F99',
      ),
    );

    expect(result).toMatchObject({
      status: 'REVIEW_REQUIRED',
      knowledgeRelationIds: [
        'support-support-conflict-a',
        'support-support-conflict-b',
      ],
    });
  });
});

describe('resolveBiosRequirement', () => {
  test('returns sorted support, minimum, and installed release provenance', () => {
    const resolution = exportedResolver()(
      ruleContext(
        [
          knowledge({
            suffix: 'provenance',
            providerId: 'provider-a',
            support: 'SUPPORTED',
            requirement: {
              kind: 'MINIMUM',
              biosVersion: 'F12',
              releaseOrdinal: 12,
            },
            releases: [{ biosVersion: 'F10', releaseOrdinal: 10 }],
          }),
        ],
        'F10',
      ),
    );

    expect(resolution).toMatchObject({
      kind: 'INSUFFICIENT',
      relationIds: [
        'minimum-provenance',
        'release-provenance-0',
        'support-provenance',
      ],
    });
  });

  test('is deterministic across snapshot and relation order without mutation', () => {
    const first = minimumKnowledge('deterministic-a');
    const second = knowledge({
      suffix: 'deterministic-b',
      providerId: 'provider-b',
      support: 'SUPPORTED',
      requirement: {
        kind: 'MINIMUM',
        biosVersion: 'F12',
        releaseOrdinal: 120,
      },
    });
    const reversedRelations = {
      ...second,
      relations: [...second.relations].reverse(),
    } satisfies KnowledgeSnapshot;
    const original = structuredClone([first, second]);

    const forward = exportedResolver()(ruleContext([first, second], 'F12'));
    const reversed = exportedResolver()(
      ruleContext([reversedRelations, first], 'F12'),
    );

    expect(reversed).toEqual(forward);
    expect([first, second]).toEqual(original);
  });
});
