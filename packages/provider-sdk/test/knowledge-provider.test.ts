import type { KnowledgeSnapshot, PartId } from '@pcpartcheck/core';
import { expect, expectTypeOf, test } from 'vitest';

import type {
  KnowledgeSnapshotProvider,
  KnowledgeSnapshotQuery,
  ProviderAttribution,
} from '../src/index.js';

const motherboardPartId = '11111111-1111-4111-8111-111111111111';
const cpuPartId = '22222222-2222-4222-8222-222222222222';

const attribution: ProviderAttribution = {
  sourceName: 'Synthetic knowledge fixture',
  sourceUrl: 'https://example.invalid/knowledge',
  license: 'Synthetic test data',
  licenseUrl: 'https://example.invalid/license',
  attributionRequired: false,
  notice: 'Synthetic provider used only for contract tests.',
};

const snapshot: KnowledgeSnapshot = {
  schemaVersion: '1.0.0',
  snapshotId: 'synthetic-snapshot-1',
  provider: {
    providerId: 'synthetic-knowledge',
    providerVersion: '1.0.0',
  },
  collectedAt: '2026-09-20T00:00:00.000Z',
  sources: [
    {
      sourceId: 'synthetic-source-1',
      sourceUri: 'https://example.invalid/knowledge/board-1',
      capturedAt: '2026-09-20T00:00:00.000Z',
      evidenceIds: [],
    },
  ],
  relations: [
    {
      relationId: 'synthetic-support-1',
      relationType: 'CPU_SUPPORT',
      subject: {
        partId: motherboardPartId,
        category: 'MOTHERBOARD',
      },
      related: { partId: cpuPartId, category: 'CPU' },
      support: 'SUPPORTED',
      biosRequirement: { kind: 'NONE' },
      sourceIds: ['synthetic-source-1'],
    },
  ],
};

class SyntheticKnowledgeProvider implements KnowledgeSnapshotProvider {
  readonly providerId = 'synthetic-knowledge';
  readonly attribution = attribution;
  readonly #snapshots: readonly KnowledgeSnapshot[];

  constructor(snapshots: readonly KnowledgeSnapshot[]) {
    this.#snapshots = structuredClone(snapshots);
  }

  async loadKnowledgeSnapshots(
    query: KnowledgeSnapshotQuery,
  ): Promise<readonly KnowledgeSnapshot[]> {
    const subjectPartIds = new Set(query.subjectPartIds);
    return structuredClone(
      this.#snapshots.filter((candidate) =>
        candidate.relations.some(({ subject }) =>
          subjectPartIds.has(subject.partId),
        ),
      ),
    );
  }
}

test('exports the provider-neutral Knowledge snapshot boundary', () => {
  expectTypeOf<KnowledgeSnapshotQuery>().toEqualTypeOf<{
    readonly subjectPartIds: readonly PartId[];
  }>();
  expectTypeOf<KnowledgeSnapshotProvider>().toMatchTypeOf<{
    readonly providerId: string;
    readonly attribution: ProviderAttribution;
    loadKnowledgeSnapshots(query: {
      readonly subjectPartIds: readonly PartId[];
    }): Promise<readonly KnowledgeSnapshot[]>;
  }>();
});

test('a synthetic provider can isolate its stored fixture from caller mutation', async () => {
  const provider = new SyntheticKnowledgeProvider([snapshot]);
  const first = await provider.loadKnowledgeSnapshots({
    subjectPartIds: [motherboardPartId],
  });

  (first as unknown as Array<{ snapshotId: string }>)[0]!.snapshotId =
    'caller-mutated';

  await expect(
    provider.loadKnowledgeSnapshots({ subjectPartIds: [motherboardPartId] }),
  ).resolves.toEqual([snapshot]);
  await expect(
    provider.loadKnowledgeSnapshots({ subjectPartIds: [cpuPartId] }),
  ).resolves.toEqual([]);
});
