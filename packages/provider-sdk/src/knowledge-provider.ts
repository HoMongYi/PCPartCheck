import type { KnowledgeSnapshot, PartId } from '@pcpartcheck/core';

import type { ProviderAttribution } from './provider.js';

export interface KnowledgeSnapshotQuery {
  readonly subjectPartIds: readonly PartId[];
}

/**
 * Provider-neutral boundary for loading immutable Knowledge snapshots.
 * Implementations must not expose mutable references to their stored records.
 */
export interface KnowledgeSnapshotProvider {
  readonly providerId: string;
  readonly attribution: ProviderAttribution;
  loadKnowledgeSnapshots(
    query: KnowledgeSnapshotQuery,
  ): Promise<readonly KnowledgeSnapshot[]>;
}
