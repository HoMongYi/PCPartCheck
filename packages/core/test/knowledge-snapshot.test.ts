import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { expect, test } from 'vitest';

import * as core from '../src/index.js';

const BOARD_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_BOARD_ID = '33333333-3333-4333-8333-333333333333';
const CPU_ID = '22222222-2222-4222-8222-222222222222';

interface ProviderFixture {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly dataRevision?: string;
  readonly schemaFingerprint?: string;
}

interface SourceFixture {
  readonly sourceId: string;
  readonly sourceUri?: string;
  readonly capturedAt: string;
  readonly contentHash?: string;
  readonly evidenceIds: readonly string[];
}

interface RelationFixture {
  readonly relationId: string;
  readonly relationType: string;
  readonly sourceIds: readonly string[];
  readonly [key: string]: unknown;
}

interface SnapshotFixture {
  readonly schemaVersion: string;
  readonly snapshotId: string;
  readonly supersedesSnapshotId?: string;
  readonly provider: ProviderFixture;
  readonly collectedAt: string;
  readonly sources: readonly SourceFixture[];
  readonly relations: readonly RelationFixture[];
}

type SourceOverrides = Omit<
  Partial<SourceFixture>,
  'contentHash' | 'sourceUri'
> & {
  readonly contentHash?: string | undefined;
  readonly sourceUri?: string | undefined;
};

type SnapshotFunction = (
  snapshots: readonly unknown[],
) => readonly SnapshotFixture[];

type ErrorConstructor = new (...args: never[]) => Error;

function exportedSchema(name: string): TSchema {
  const candidate = (core as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as TSchema;
}

function exportedFunction(name: string): SnapshotFunction {
  const candidate = (core as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeTypeOf('function');
  return candidate as SnapshotFunction;
}

function exportedError(name: string): ErrorConstructor {
  const candidate = (core as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeTypeOf('function');
  return candidate as ErrorConstructor;
}

function source(overrides: SourceOverrides = {}): SourceFixture {
  const value: {
    sourceId: string;
    sourceUri?: string;
    capturedAt: string;
    contentHash?: string;
    evidenceIds: readonly string[];
  } = {
    sourceId: overrides.sourceId ?? 'source-a',
    capturedAt: overrides.capturedAt ?? '2026-09-20T00:00:00.000Z',
    evidenceIds: overrides.evidenceIds ?? [],
  };
  if (!('sourceUri' in overrides)) {
    value.sourceUri = 'https://example.invalid/boards/example-board';
  } else if (overrides.sourceUri !== undefined) {
    value.sourceUri = overrides.sourceUri;
  }
  if (overrides.contentHash !== undefined) {
    value.contentHash = overrides.contentHash;
  }
  return value;
}

function biosRelease(
  overrides: Partial<RelationFixture> = {},
): RelationFixture {
  return {
    relationId: 'bios-a',
    relationType: 'BIOS_RELEASE',
    subject: { partId: BOARD_ID, category: 'MOTHERBOARD' },
    biosVersion: 'F10',
    releaseOrdinal: 10,
    releasedAt: '2026-09-19T00:00:00.000Z',
    sourceIds: ['source-a'],
    ...overrides,
  };
}

function supportedCpu(
  overrides: Partial<RelationFixture> = {},
): RelationFixture {
  return {
    relationId: 'support-a',
    relationType: 'CPU_SUPPORT',
    subject: { partId: BOARD_ID, category: 'MOTHERBOARD' },
    related: { partId: CPU_ID, category: 'CPU' },
    support: 'SUPPORTED',
    biosRequirement: { kind: 'MINIMUM', biosReleaseId: 'bios-a' },
    sourceIds: ['source-a'],
    ...overrides,
  };
}

function unsupportedCpu(
  overrides: Partial<RelationFixture> = {},
): RelationFixture {
  return {
    relationId: 'support-b',
    relationType: 'CPU_SUPPORT',
    subject: { partId: BOARD_ID, category: 'MOTHERBOARD' },
    related: { partId: CPU_ID, category: 'CPU' },
    support: 'UNSUPPORTED',
    sourceIds: ['source-a'],
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<SnapshotFixture> = {},
): SnapshotFixture {
  return {
    schemaVersion: '1.0.0',
    snapshotId: 'snapshot-a',
    provider: {
      providerId: 'synthetic-manufacturer',
      providerVersion: '1',
      dataRevision: 'revision-a',
      schemaFingerprint: 'synthetic-schema-a',
    },
    collectedAt: '2026-09-20T00:00:00.000Z',
    sources: [source()],
    relations: [supportedCpu(), biosRelease()],
    ...overrides,
  };
}

test('exports Knowledge Snapshot 1.0 and accepts a provider-neutral snapshot', () => {
  const schema = exportedSchema('KnowledgeSnapshotSchema');
  const version = (core as Readonly<Record<string, unknown>>)
    .KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION;

  expect(version).toBe('1.0.0');
  expect(Value.Check(schema, snapshot())).toBe(true);
});

test('canonicalizes snapshot, source, and relation order without mutating input', () => {
  const canonicalize = exportedFunction(
    'validateAndCanonicalizeKnowledgeSnapshots',
  );
  const sourceA = source();
  const sourceB = source({
    sourceId: 'source-b',
    sourceUri: undefined,
    contentHash: 'sha256:synthetic-b',
  });
  const first = snapshot({
    snapshotId: 'snapshot-b',
    sources: [sourceB, sourceA],
    relations: [
      unsupportedCpu({ relationId: 'support-z', sourceIds: ['source-b'] }),
      biosRelease(),
      supportedCpu(),
    ],
  });
  const second = snapshot({
    snapshotId: 'snapshot-a',
    provider: {
      providerId: 'synthetic-manufacturer',
      providerVersion: '2',
    },
    relations: [
      supportedCpu({
        relationId: 'support-second',
        biosRequirement: {
          kind: 'MINIMUM',
          biosReleaseId: 'bios-second',
        },
      }),
      biosRelease({ relationId: 'bios-second' }),
    ],
  });
  const input = [first, second] as const;
  const before = structuredClone(input);

  const forward = canonicalize(input);
  const reversed = canonicalize([
    { ...second, relations: [...second.relations].reverse() },
    {
      ...first,
      sources: [...first.sources].reverse(),
      relations: [...first.relations].reverse(),
    },
  ]);

  expect(forward).toEqual(reversed);
  expect(forward.map(({ snapshotId }) => snapshotId)).toEqual([
    'snapshot-a',
    'snapshot-b',
  ]);
  expect(forward[1]?.sources.map(({ sourceId }) => sourceId)).toEqual([
    'source-a',
    'source-b',
  ]);
  expect(forward[1]?.relations.map(({ relationId }) => relationId)).toEqual([
    'bios-a',
    'support-a',
    'support-z',
  ]);
  expect(input).toEqual(before);
  expect(forward).not.toBe(input);
  expect(forward[0]).not.toBe(second);
});

test('preserves provider versions and durable provenance for replay', () => {
  const canonicalize = exportedFunction(
    'validateAndCanonicalizeKnowledgeSnapshots',
  );
  const oldSnapshot = snapshot({
    snapshotId: 'snapshot-old',
    provider: {
      providerId: 'synthetic-manufacturer',
      providerVersion: '1',
    },
    sources: [
      source({
        sourceUri: undefined,
        contentHash: 'sha256:old',
        evidenceIds: ['evidence-old'],
      }),
    ],
  });
  const newSnapshot = snapshot({
    snapshotId: 'snapshot-new',
    supersedesSnapshotId: 'snapshot-old',
    provider: {
      providerId: 'synthetic-manufacturer',
      providerVersion: '2',
    },
    relations: [
      supportedCpu({
        relationId: 'support-new',
        biosRequirement: { kind: 'MINIMUM', biosReleaseId: 'bios-new' },
      }),
      biosRelease({ relationId: 'bios-new' }),
    ],
  });

  const normalized = canonicalize([oldSnapshot, newSnapshot]);

  expect(normalized.map(({ provider }) => provider.providerVersion)).toEqual([
    '2',
    '1',
  ]);
  expect(normalized[1]?.sources[0]).toMatchObject({
    sourceId: 'source-a',
    contentHash: 'sha256:old',
    evidenceIds: ['evidence-old'],
  });
});

test('rejects malformed snapshots with the public validation error', () => {
  const canonicalize = exportedFunction(
    'validateAndCanonicalizeKnowledgeSnapshots',
  );
  const InvalidKnowledgeSnapshotError = exportedError(
    'InvalidKnowledgeSnapshotError',
  );
  const valid = snapshot();
  const withoutProvider = Object.fromEntries(
    Object.entries(valid).filter(([key]) => key !== 'provider'),
  );

  const malformed = [
    { ...valid, schemaVersion: '0.9.0' },
    withoutProvider,
    { ...valid, provider: { providerId: 'synthetic-manufacturer' } },
    {
      ...valid,
      relations: [
        supportedCpu({
          subject: { partId: 'not-a-part-id', category: 'MOTHERBOARD' },
        }),
        biosRelease(),
      ],
    },
    {
      ...valid,
      relations: [
        { ...supportedCpu(), relationType: 'MEMORY_QVL' },
        biosRelease(),
      ],
    },
    {
      ...valid,
      relations: [
        supportedCpu({ biosRequirement: undefined }),
        biosRelease(),
      ],
    },
    {
      ...valid,
      relations: [biosRelease({ releaseOrdinal: -1 }), supportedCpu()],
    },
  ];

  for (const invalid of malformed) {
    expect(() => canonicalize([invalid])).toThrow(
      InvalidKnowledgeSnapshotError,
    );
  }
});

test('rejects missing and non-durable source provenance', () => {
  const canonicalize = exportedFunction(
    'validateAndCanonicalizeKnowledgeSnapshots',
  );

  expect(() =>
    canonicalize([
      snapshot({
        sources: [],
        relations: [
          supportedCpu({ sourceIds: ['missing'] }),
          biosRelease({ sourceIds: ['missing'] }),
        ],
      }),
    ]),
  ).toThrow('Unknown knowledge sourceId: missing');
  expect(() =>
    canonicalize([
      snapshot({
        sources: [
          source({
            sourceUri: undefined,
            contentHash: undefined,
            evidenceIds: [],
          }),
        ],
      }),
    ]),
  ).toThrow('Knowledge source source-a has no durable provenance locator');
  expect(() =>
    canonicalize([
      snapshot({
        relations: [
          supportedCpu({ sourceIds: [] }),
          biosRelease(),
        ],
      }),
    ]),
  ).toThrow('Knowledge relation support-a has no sourceIds');
});

test('rejects ambiguous snapshot, source, and relation identities', () => {
  const canonicalize = exportedFunction(
    'validateAndCanonicalizeKnowledgeSnapshots',
  );

  expect(() => canonicalize([snapshot(), snapshot()])).toThrow(
    'Duplicate knowledge snapshotId: snapshot-a',
  );
  expect(() =>
    canonicalize([
      snapshot({ sources: [source(), source()] }),
    ]),
  ).toThrow('Duplicate knowledge sourceId: source-a');
  expect(() =>
    canonicalize([
      snapshot({
        relations: [
          supportedCpu({ relationId: 'same' }),
          unsupportedCpu({ relationId: 'same' }),
          biosRelease(),
        ],
      }),
    ]),
  ).toThrow('Duplicate knowledge relationId: same');
});

test('requires minimum BIOS references to resolve to the same motherboard condition', () => {
  const canonicalize = exportedFunction(
    'validateAndCanonicalizeKnowledgeSnapshots',
  );

  expect(() =>
    canonicalize([
      snapshot({
        relations: [
          supportedCpu({
            biosRequirement: { kind: 'MINIMUM', biosReleaseId: 'missing' },
          }),
          biosRelease(),
        ],
      }),
    ]),
  ).toThrow('Unknown minimum BIOS releaseId: missing');
  expect(() =>
    canonicalize([
      snapshot({
        relations: [
          supportedCpu(),
          biosRelease({
            subject: {
              partId: OTHER_BOARD_ID,
              category: 'MOTHERBOARD',
            },
          }),
        ],
      }),
    ]),
  ).toThrow('Minimum BIOS motherboard identity mismatch: support-a');
  expect(() =>
    canonicalize([
      snapshot({
        relations: [
          supportedCpu({
            subject: {
              partId: BOARD_ID,
              category: 'MOTHERBOARD',
              hardwareRevision: '1.0',
            },
          }),
          biosRelease(),
        ],
      }),
    ]),
  ).toThrow('Minimum BIOS motherboard identity mismatch: support-a');
});

test('keeps old snapshots and activates only explicit supersession leaves', () => {
  const canonicalize = exportedFunction(
    'validateAndCanonicalizeKnowledgeSnapshots',
  );
  const activeSnapshots = exportedFunction('activeKnowledgeSnapshots');
  const oldSnapshot = snapshot({ snapshotId: 'old' });
  const newSnapshot = snapshot({
    snapshotId: 'new',
    supersedesSnapshotId: 'old',
    provider: {
      providerId: 'synthetic-manufacturer',
      providerVersion: '2',
    },
    relations: [
      supportedCpu({
        relationId: 'support-new',
        biosRequirement: { kind: 'MINIMUM', biosReleaseId: 'bios-new' },
      }),
      biosRelease({ relationId: 'bios-new' }),
    ],
  });
  const parallelSnapshot = snapshot({
    snapshotId: 'parallel',
    provider: {
      providerId: 'synthetic-manufacturer',
      providerVersion: 'parallel',
    },
    relations: [
      unsupportedCpu({ relationId: 'support-parallel' }),
      biosRelease({ relationId: 'bios-parallel' }),
    ],
  });

  const replayInput = canonicalize([
    newSnapshot,
    parallelSnapshot,
    oldSnapshot,
  ]);

  expect(replayInput.map(({ snapshotId }) => snapshotId)).toEqual([
    'new',
    'old',
    'parallel',
  ]);
  expect(activeSnapshots(replayInput).map(({ snapshotId }) => snapshotId)).toEqual([
    'new',
    'parallel',
  ]);
});

test('rejects dangling, cross-provider, self, and cyclic supersession', () => {
  const canonicalize = exportedFunction(
    'validateAndCanonicalizeKnowledgeSnapshots',
  );

  expect(() =>
    canonicalize([
      snapshot({ supersedesSnapshotId: 'missing' }),
    ]),
  ).toThrow('Unknown supersedesSnapshotId: missing');
  expect(() =>
    canonicalize([
      snapshot({ snapshotId: 'old' }),
      snapshot({
        snapshotId: 'new',
        supersedesSnapshotId: 'old',
        provider: { providerId: 'other-provider', providerVersion: '1' },
        relations: [
          supportedCpu({
            relationId: 'support-new',
            biosRequirement: {
              kind: 'MINIMUM',
              biosReleaseId: 'bios-new',
            },
          }),
          biosRelease({ relationId: 'bios-new' }),
        ],
      }),
    ]),
  ).toThrow('Knowledge supersession provider mismatch: new');
  expect(() =>
    canonicalize([
      snapshot({ supersedesSnapshotId: 'snapshot-a' }),
    ]),
  ).toThrow('Knowledge snapshot cannot supersede itself: snapshot-a');
  expect(() =>
    canonicalize([
      snapshot({ snapshotId: 'a', supersedesSnapshotId: 'b' }),
      snapshot({
        snapshotId: 'b',
        supersedesSnapshotId: 'a',
        relations: [
          supportedCpu({
            relationId: 'support-b',
            biosRequirement: { kind: 'MINIMUM', biosReleaseId: 'bios-b' },
          }),
          biosRelease({ relationId: 'bios-b' }),
        ],
      }),
    ]),
  ).toThrow('Knowledge supersession cycle');
});

test('keeps NONE and UNKNOWN BIOS requirements semantically distinct', () => {
  const canonicalize = exportedFunction(
    'validateAndCanonicalizeKnowledgeSnapshots',
  );
  const none = snapshot({
    snapshotId: 'none',
    relations: [
      supportedCpu({
        relationId: 'support-none',
        biosRequirement: { kind: 'NONE' },
      }),
    ],
  });
  const unknown = snapshot({
    snapshotId: 'unknown',
    provider: {
      providerId: 'synthetic-manufacturer',
      providerVersion: '2',
    },
    relations: [
      supportedCpu({
        relationId: 'support-unknown',
        biosRequirement: { kind: 'UNKNOWN' },
      }),
    ],
  });

  const normalized = canonicalize([unknown, none]);
  const noneRequirement = normalized[0]?.relations[0]?.biosRequirement;
  const unknownRequirement = normalized[1]?.relations[0]?.biosRequirement;

  expect(noneRequirement).toEqual({ kind: 'NONE' });
  expect(unknownRequirement).toEqual({ kind: 'UNKNOWN' });
  expect(noneRequirement).not.toEqual(unknownRequirement);
});
