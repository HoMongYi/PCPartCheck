import type { KnowledgeSnapshot } from '@pcpartcheck/core';

export const SYNTHETIC_CPU_PART_ID = '10000000-0000-4000-8000-000000000001';
export const SYNTHETIC_MOTHERBOARD_PART_ID = '10000000-0000-4000-8000-000000000002';

export const SYNTHETIC_KNOWLEDGE_SNAPSHOTS: readonly KnowledgeSnapshot[] = [
  {
    schemaVersion: '1.0.0',
    snapshotId: 'synthetic-manufacturer-knowledge-v2',
    provider: {
      providerId: 'synthetic-manufacturer',
      providerVersion: '2.0.0',
      dataRevision: 'fixture-2026-09-20',
      schemaFingerprint: 'sha256:synthetic-knowledge-v2',
    },
    collectedAt: '2026-09-20T00:00:00.000Z',
    sources: [
      {
        sourceId: 'synthetic-support-source',
        sourceUri: 'https://example.invalid/knowledge/cpu-support',
        capturedAt: '2026-09-20T00:00:00.000Z',
        contentHash: 'sha256:synthetic-support-source',
        evidenceIds: [],
      },
      {
        sourceId: 'synthetic-bios-source',
        sourceUri: 'https://example.invalid/knowledge/bios-releases',
        capturedAt: '2026-09-20T00:00:00.000Z',
        contentHash: 'sha256:synthetic-bios-source',
        evidenceIds: [],
      },
    ],
    relations: [
      {
        relationId: 'synthetic-bios-f10',
        relationType: 'BIOS_RELEASE',
        subject: {
          partId: SYNTHETIC_MOTHERBOARD_PART_ID,
          category: 'MOTHERBOARD',
          hardwareRevision: 'R1',
        },
        biosVersion: 'F10',
        releaseOrdinal: 1,
        sourceIds: ['synthetic-bios-source'],
      },
      {
        relationId: 'synthetic-bios-f12',
        relationType: 'BIOS_RELEASE',
        subject: {
          partId: SYNTHETIC_MOTHERBOARD_PART_ID,
          category: 'MOTHERBOARD',
          hardwareRevision: 'R1',
        },
        biosVersion: 'F12',
        releaseOrdinal: 2,
        sourceIds: ['synthetic-bios-source'],
      },
      {
        relationId: 'synthetic-cpu-support',
        relationType: 'CPU_SUPPORT',
        subject: {
          partId: SYNTHETIC_MOTHERBOARD_PART_ID,
          category: 'MOTHERBOARD',
          hardwareRevision: 'R1',
        },
        related: {
          partId: SYNTHETIC_CPU_PART_ID,
          category: 'CPU',
          hardwareRevision: 'C1',
        },
        support: 'SUPPORTED',
        biosRequirement: {
          kind: 'MINIMUM',
          biosReleaseId: 'synthetic-bios-f12',
        },
        sourceIds: ['synthetic-support-source'],
      },
    ],
  },
];
