import { describe, expect, test } from 'vitest';

import type {
  CanonicalPart,
  CompatibilityCheckInput,
  KnowledgeSnapshot,
  ResultSnapshot,
} from '../../packages/core/src/index.js';

import type {
  FieldEvidenceDraftInput,
  FieldEvidenceModeration,
  FieldEvidenceMutationAudit,
  FieldEvidenceRecord,
} from '../../packages/evidence/src/index.js';
import * as referenceApi from '../../apps/reference-api/src/services.js';
import { buildReferenceServer } from '../../apps/reference-api/src/server.js';

describe('reference API composition', () => {
  test('filters Similar Evidence by the server-derived read scope', async () => {
    const factory = (referenceApi as Readonly<Record<string, unknown>>)
      .createReferenceApiServices as () => {
        createFieldEvidence(
          input: FieldEvidenceDraftInput,
          audit: FieldEvidenceMutationAudit,
        ): Promise<FieldEvidenceRecord>;
        moderateFieldEvidence(
          evidenceId: string,
          moderation: FieldEvidenceModeration,
        ): Promise<FieldEvidenceRecord | undefined>;
        findSimilarEvidence(
          query: Readonly<Record<string, unknown>>,
          readScope: 'PUBLIC' | 'STAFF' | 'ADMIN',
        ): Promise<readonly { readonly evidenceId: string }[]>;
      };
    const services = factory();
    const installationContext = { schemaVersion: '2.1.0' as const };
    const visibilities = ['PUBLIC', 'STAFF_ONLY', 'ADMIN_ONLY'] as const;
    for (const [index, visibility] of visibilities.entries()) {
      const evidenceId = `scope-${visibility.toLocaleLowerCase('en-US')}`;
      const partId = `30000000-0000-4000-8000-00000000000${index + 1}`;
      await services.createFieldEvidence(
        {
          evidenceId,
          visibility,
          redaction: 'NONE',
          outcome: 'ASSEMBLY_FAILURE',
          issueType: 'STORAGE_RESOURCE',
          parts: [{
            category: 'STORAGE',
            partId,
            hardwareRevision: 'A1',
          }],
          exactScope: {
            requiredPartCategories: ['STORAGE'],
            requiredContextFields: [
              'occupiedPcieSlotIds',
              'installedBiosVersion',
              'componentRevisions',
            ],
          },
          installationContext: {
            ...installationContext,
            occupiedPcieSlotIds: [],
            componentRevisions: [{ partId, hardwareRevision: 'A1' }],
            installedBiosVersion: 'F12',
          },
          reportedAt: '2026-09-09T00:00:00.000Z',
        },
        { principalId: 'scope-writer', at: '2026-09-09T00:00:00.000Z' },
      );
      await services.moderateFieldEvidence(evidenceId, {
        action: 'APPROVE',
        principalId: 'scope-moderator',
        at: '2026-09-09T00:01:00.000Z',
      });
    }
    const query = {
      issueType: 'STORAGE_RESOURCE',
      parts: [{
        category: 'STORAGE',
        partId: '40000000-0000-4000-8000-000000000001',
      }],
      installationContext,
    };

    const publicMatches = await services.findSimilarEvidence(query, 'PUBLIC');
    const staffMatches = await services.findSimilarEvidence(query, 'STAFF');
    const adminMatches = await services.findSimilarEvidence(query, 'ADMIN');

    expect(publicMatches.map(({ evidenceId }) => evidenceId)).toEqual([
      'scope-public',
    ]);
    expect(staffMatches.map(({ evidenceId }) => evidenceId).sort()).toEqual([
      'scope-public',
      'scope-staff_only',
    ]);
    expect(adminMatches.map(({ evidenceId }) => evidenceId).sort()).toEqual([
      'scope-admin_only',
      'scope-public',
      'scope-staff_only',
    ]);
    for (const match of adminMatches) {
      expect(match).not.toHaveProperty('status');
      expect(match).not.toHaveProperty('decision');
    }
  });

  test('evaluates every synthetic scenario and exposes only the top three similar records', async () => {
    const factory = (referenceApi as Readonly<Record<string, unknown>>)
      .createReferenceApiServices;
    expect(factory).toBeTypeOf('function');

    const services = (factory as () => {
      getDemoDashboard(): Promise<{
        scenarios: readonly Readonly<Record<string, unknown>>[];
        similarEvidence: readonly Readonly<Record<string, unknown>>[];
        exactEvidence: Readonly<Record<string, unknown>>;
      }>;
    })();
    const dashboard = await services.getDemoDashboard();

    expect(dashboard.scenarios).toHaveLength(12);
    expect(dashboard.scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'compatible-platform', decision: 'ALLOW' }),
        expect.objectContaining({ id: 'socket-mismatch', decision: 'BLOCK' }),
        expect.objectContaining({
          id: 'advisory-rgb-mismatch',
          status: 'INCOMPATIBLE',
          decision: 'ALLOW_WITH_WARNING',
        }),
        expect.objectContaining({ id: 'missing-clearance-data', decision: 'REVIEW' }),
        expect.objectContaining({
          id: 'power-budget-warning',
          status: 'WARNING',
          decision: 'ALLOW_WITH_WARNING',
          powerBudget: {
            estimatedPeakPowerW: 500,
            minimumPsuW: 600,
            calculatedRecommendedPsuW: 650,
            recommendedPsuW: 750,
            ratedPsuW: 600,
          },
        }),
        expect.objectContaining({
          id: 'disabled-capability',
          status: 'NOT_CHECKED',
          decision: 'NO_DECISION',
        }),
        expect.objectContaining({
          id: 'missing-cpu-support-knowledge',
          decision: 'REVIEW',
        }),
        expect.objectContaining({
          id: 'insufficient-minimum-bios',
          decision: 'BLOCK',
        }),
        expect.objectContaining({
          id: 'exact-field-evidence-failure',
          decision: 'BLOCK',
        }),
      ]),
    );
    expect(dashboard.scenarios.every((scenario) =>
      Array.isArray(scenario.ruleResults) && Array.isArray(scenario.capabilities),
    )).toBe(true);
    expect(dashboard.exactEvidence).toMatchObject({
      match: 'EXACT',
      resultStatus: 'INCOMPATIBLE',
    });
    expect(dashboard.similarEvidence).toHaveLength(3);
    expect(dashboard.similarEvidence[0]).not.toHaveProperty('status');
    expect(dashboard.similarEvidence[0]).not.toHaveProperty('decision');
  });

  test('serves only the synthetic demo attachment through the reference API', async () => {
    const server = await buildReferenceServer();
    const response = await server.inject({
      method: 'GET',
      url: '/v1/field-evidence/demo-field-clearance-exact/attachments/demo-clearance-photo',
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      reference: {
        attachmentId: 'demo-clearance-photo',
        mediaType: 'image/png',
        description: '합성 데모 조립 사진',
      },
    });
  });

  test('publishes a safe reference policy and disabled future capabilities', async () => {
    const factory = (referenceApi as Readonly<Record<string, unknown>>)
      .createReferenceApiServices as () => {
        listCapabilities(): Promise<readonly Readonly<Record<string, unknown>>[]>;
        listProfiles(): Promise<readonly {
          readonly profileId: string;
          readonly capabilities: readonly {
            readonly capabilityId: string;
            readonly mode: string;
          }[];
        }[]>;
      };
    const services = factory();
    const [capabilities, profiles] = await Promise.all([
      services.listCapabilities(),
      services.listProfiles(),
    ]);
    const modes = new Map(
      profiles[0]?.capabilities.map(({ capabilityId, mode }) => [capabilityId, mode]),
    );

    expect(profiles[0]?.profileId).toBe('reference-default');
    for (const capabilityId of [
      'socket', 'memory-generation', 'memory-capacity', 'form-factor',
      'gpu-clearance', 'cooler-clearance', 'psu-clearance', 'radiator',
      'cooler-socket', 'storage', 'storage-sharing', 'pcie-slot',
      'power-budget', 'psu-connector', 'cpu-support', 'bios',
      'psu-form-factor', 'exact-field-evidence',
    ]) {
      expect(modes.get(capabilityId)).toBe('REQUIRED');
    }
    for (const capabilityId of [
      'pcie-bandwidth', 'fan-headers', 'rgb', 'memory-rate', 'four-dimm-rate',
    ]) {
      expect(modes.get(capabilityId)).toBe('ADVISORY');
    }
    for (const capabilityId of [
      'manufacturer-specification', 'qvl',
    ]) {
      expect(capabilities).toContainEqual(expect.objectContaining({
        capabilityId,
        providerAvailable: false,
        defaultMode: 'DISABLED',
      }));
      expect(modes.get(capabilityId)).toBe('DISABLED');
    }
  });

  test('returns bounded catalog pages with a stable next offset', async () => {
    const factory = (referenceApi as Readonly<Record<string, unknown>>)
      .createReferenceApiServices as () => {
        listParts(query: Readonly<Record<string, unknown>>): Promise<{
          readonly items: readonly unknown[];
          readonly total: number;
          readonly limit: number;
          readonly offset: number;
          readonly nextOffset?: number;
        }>;
      };
    const services = factory();
    const first = await services.listParts({ limit: 2, offset: 0 });
    const second = await services.listParts({ limit: 2, offset: 2 });

    expect(first.items).toHaveLength(2);
    expect(first).toMatchObject({ limit: 2, offset: 0, nextOffset: 2 });
    expect(second.items).toHaveLength(2);
    expect(second).toMatchObject({ total: first.total, limit: 2, offset: 2 });
    expect(second.items).not.toEqual(first.items);
  });
});

const syntheticCpu: CanonicalPart = {
  schemaVersion: '3.1.0',
  partId: '51000000-0000-4000-8000-000000000001',
  category: 'CPU',
  manufacturer: 'Synthetic',
  model: 'CPU',
  status: 'ACTIVE',
  spec: { socket: 'AM5' },
};
const syntheticBoard: CanonicalPart = {
  schemaVersion: '3.1.0',
  partId: '51000000-0000-4000-8000-000000000002',
  category: 'MOTHERBOARD',
  manufacturer: 'Synthetic',
  model: 'Board',
  status: 'ACTIVE',
  spec: { socket: 'AM5', formFactor: 'ATX', memoryTechnologies: ['DDR5'] },
};
const syntheticCase: CanonicalPart = {
  schemaVersion: '3.1.0',
  partId: '51000000-0000-4000-8000-000000000003',
  category: 'PC_CASE',
  manufacturer: 'Synthetic',
  model: 'Case',
  status: 'ACTIVE',
  spec: {
    supportedMotherboardFormFactors: ['ATX'],
    supportedPsuFormFactors: ['ATX'],
  },
};
const syntheticPsu: CanonicalPart = {
  schemaVersion: '3.1.0',
  partId: '51000000-0000-4000-8000-000000000004',
  category: 'PSU',
  manufacturer: 'Synthetic',
  model: 'PSU',
  status: 'ACTIVE',
  spec: { formFactor: 'ATX', ratedPowerW: 850, powerConnectors: [] },
};

const emptyFieldEvidenceSnapshot = {
  fieldEvidenceSchemaVersion: '4.0.0',
  evidencePolicyVersion: '1.0.0',
  records: [],
} as const;

function syntheticRequest(
  parts: readonly CanonicalPart[],
  capabilities: CompatibilityCheckInput['policyProfile']['capabilities'],
  options: {
    readonly knowledgeSnapshots?: readonly KnowledgeSnapshot[];
    readonly installationContext?: CompatibilityCheckInput['installationContext'];
    readonly evidenceSnapshot?: CompatibilityCheckInput['evidenceSnapshot'];
  } = {},
): CompatibilityCheckInput {
  return {
    build: { schemaVersion: '3.1.0', parts: [...parts] },
    intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
    installationContext: options.installationContext ?? { schemaVersion: '2.1.0' },
    policyProfile: {
      profileId: 'synthetic-v0.2',
      policyVersion: '2.0.0',
      capabilities,
    },
    evidenceSnapshot: options.evidenceSnapshot ?? emptyFieldEvidenceSnapshot,
    ...(options.knowledgeSnapshots === undefined
      ? {}
      : { knowledgeSnapshots: options.knowledgeSnapshots }),
  };
}

function knowledgeSnapshot(
  snapshotId: string,
  providerId: string,
  providerVersion: string,
  support: 'SUPPORTED' | 'UNSUPPORTED',
  options: { readonly supersedesSnapshotId?: string } = {},
): KnowledgeSnapshot {
  const sourceId = `${snapshotId}-source`;
  const relation: KnowledgeSnapshot['relations'][number] = support === 'SUPPORTED'
    ? {
        relationId: `${snapshotId}-support`,
        relationType: 'CPU_SUPPORT',
        subject: {
          partId: syntheticBoard.partId,
          category: 'MOTHERBOARD',
          hardwareRevision: 'R1',
        },
        related: {
          partId: syntheticCpu.partId,
          category: 'CPU',
          hardwareRevision: 'C1',
        },
        support: 'SUPPORTED',
        biosRequirement: { kind: 'NONE' },
        sourceIds: [sourceId],
      }
    : {
        relationId: `${snapshotId}-support`,
        relationType: 'CPU_SUPPORT',
        subject: {
          partId: syntheticBoard.partId,
          category: 'MOTHERBOARD',
          hardwareRevision: 'R1',
        },
        related: {
          partId: syntheticCpu.partId,
          category: 'CPU',
          hardwareRevision: 'C1',
        },
        support: 'UNSUPPORTED',
        sourceIds: [sourceId],
      };
  return {
    schemaVersion: '1.0.0',
    snapshotId,
    ...(options.supersedesSnapshotId === undefined
      ? {}
      : { supersedesSnapshotId: options.supersedesSnapshotId }),
    provider: { providerId, providerVersion },
    collectedAt: '2026-09-20T00:00:00.000Z',
    sources: [{
      sourceId,
      sourceUri: `https://example.invalid/knowledge/${snapshotId}`,
      capturedAt: '2026-09-20T00:00:00.000Z',
      contentHash: `sha256:${snapshotId}`,
      evidenceIds: [],
    }],
    relations: [relation],
  };
}

async function checkSynthetic(
  request: CompatibilityCheckInput,
): Promise<ResultSnapshot> {
  const factory = (referenceApi as Readonly<Record<string, unknown>>)
    .createReferenceApiServices as () => {
      checkCompatibility(input: CompatibilityCheckInput): Promise<ResultSnapshot>;
    };
  return factory().checkCompatibility(request);
}

describe('v0.2 synthetic vertical slice', () => {
  test('returns review when CPU support knowledge is absent', async () => {
    const response = await checkSynthetic(syntheticRequest(
      [syntheticCpu, syntheticBoard],
      [{ capabilityId: 'cpu-support', mode: 'REQUIRED' }],
      { knowledgeSnapshots: [] },
    ));

    expect(response.resultSnapshot).toMatchObject({
      status: 'UNKNOWN',
      decision: 'REVIEW',
      issues: { reviewRuleIds: ['cpu-support'] },
    });
  });

  test('blocks a known insufficient BIOS on the full synthetic flow', async () => {
    const sourceId = 'bios-source';
    const knowledge: KnowledgeSnapshot = {
      schemaVersion: '1.0.0',
      snapshotId: 'bios-knowledge',
      provider: { providerId: 'synthetic-manufacturer', providerVersion: '2.0.0' },
      collectedAt: '2026-09-20T00:00:00.000Z',
      sources: [{
        sourceId,
        sourceUri: 'https://example.invalid/knowledge/bios',
        capturedAt: '2026-09-20T00:00:00.000Z',
        contentHash: 'sha256:bios-fixture',
        evidenceIds: [],
      }],
      relations: [
        {
          relationId: 'bios-installed',
          relationType: 'BIOS_RELEASE',
          subject: {
            partId: syntheticBoard.partId,
            category: 'MOTHERBOARD',
            hardwareRevision: 'R1',
          },
          biosVersion: 'F10',
          releaseOrdinal: 1,
          sourceIds: [sourceId],
        },
        {
          relationId: 'bios-minimum',
          relationType: 'BIOS_RELEASE',
          subject: {
            partId: syntheticBoard.partId,
            category: 'MOTHERBOARD',
            hardwareRevision: 'R1',
          },
          biosVersion: 'F12',
          releaseOrdinal: 2,
          sourceIds: [sourceId],
        },
        {
          relationId: 'cpu-support-minimum',
          relationType: 'CPU_SUPPORT',
          subject: {
            partId: syntheticBoard.partId,
            category: 'MOTHERBOARD',
            hardwareRevision: 'R1',
          },
          related: {
            partId: syntheticCpu.partId,
            category: 'CPU',
            hardwareRevision: 'C1',
          },
          support: 'SUPPORTED',
          biosRequirement: { kind: 'MINIMUM', biosReleaseId: 'bios-minimum' },
          sourceIds: [sourceId],
        },
      ],
    };
    const response = await checkSynthetic(syntheticRequest(
      [syntheticCpu, syntheticBoard],
      [
        { capabilityId: 'cpu-support', mode: 'REQUIRED' },
        { capabilityId: 'bios', mode: 'REQUIRED' },
      ],
      {
        knowledgeSnapshots: [knowledge],
        installationContext: {
          schemaVersion: '2.1.0',
          componentRevisions: [
            { partId: syntheticCpu.partId, hardwareRevision: 'C1' },
            { partId: syntheticBoard.partId, hardwareRevision: 'R1' },
          ],
          installedBiosVersion: 'F10',
        },
      },
    ));

    expect(response.resultSnapshot).toMatchObject({
      status: 'INCOMPATIBLE',
      decision: 'BLOCK',
      issues: { blockingRuleIds: ['minimum-bios'] },
    });
  });

  test('keeps stale provider snapshots for replay but evaluates the active leaf', async () => {
    const oldSnapshot = knowledgeSnapshot(
      'provider-old',
      'synthetic-manufacturer',
      '1.0.0',
      'UNSUPPORTED',
    );
    const currentSnapshot = knowledgeSnapshot(
      'provider-current',
      'synthetic-manufacturer',
      '2.0.0',
      'SUPPORTED',
      { supersedesSnapshotId: 'provider-old' },
    );
    const response = await checkSynthetic(syntheticRequest(
      [syntheticCpu, syntheticBoard],
      [{ capabilityId: 'cpu-support', mode: 'REQUIRED' }],
      {
        knowledgeSnapshots: [currentSnapshot, oldSnapshot],
        installationContext: {
          schemaVersion: '2.1.0',
          componentRevisions: [
            { partId: syntheticCpu.partId, hardwareRevision: 'C1' },
            { partId: syntheticBoard.partId, hardwareRevision: 'R1' },
          ],
        },
      },
    ));

    expect(response.resultSnapshot.decision).toBe('ALLOW');
    expect(response.inputSnapshot.knowledgeSnapshots.map(({ snapshotId }) => snapshotId))
      .toEqual(['provider-current', 'provider-old']);
  });

  test('returns review for active cross-provider CPU relation ambiguity', async () => {
    const response = await checkSynthetic(syntheticRequest(
      [syntheticCpu, syntheticBoard],
      [{ capabilityId: 'cpu-support', mode: 'REQUIRED' }],
      {
        knowledgeSnapshots: [
          knowledgeSnapshot('provider-a', 'provider-a', '1.0.0', 'SUPPORTED'),
          knowledgeSnapshot('provider-b', 'provider-b', '7.0.0', 'UNSUPPORTED'),
        ],
        installationContext: {
          schemaVersion: '2.1.0',
          componentRevisions: [
            { partId: syntheticCpu.partId, hardwareRevision: 'C1' },
            { partId: syntheticBoard.partId, hardwareRevision: 'R1' },
          ],
        },
      },
    ));

    expect(response.resultSnapshot).toMatchObject({
      status: 'REVIEW_REQUIRED',
      decision: 'REVIEW',
    });
  });

  test.each([
    ['supported', [syntheticCase, syntheticPsu], 'REQUIRED', 'PASS', 'ALLOW'],
    [
      'unsupported',
      [syntheticCase, { ...syntheticPsu, spec: { ...syntheticPsu.spec, formFactor: 'SFX' } }],
      'REQUIRED',
      'INCOMPATIBLE',
      'BLOCK',
    ],
    ['missing', [syntheticPsu], 'REQUIRED', 'UNKNOWN', 'REVIEW'],
    ['disabled', [syntheticCase, syntheticPsu], 'DISABLED', 'NOT_CHECKED', 'NO_DECISION'],
  ] as const)('preserves the PSU form-factor %s outcome', async (
    _name,
    parts,
    mode,
    status,
    decision,
  ) => {
    const response = await checkSynthetic(syntheticRequest(
      parts,
      [{ capabilityId: 'psu-form-factor', mode }],
    ));
    expect(response.resultSnapshot).toMatchObject({ status, decision });
  });

  test('lets active exact failure block while a revision mismatch remains non-automatic', async () => {
    const context: CompatibilityCheckInput['installationContext'] = {
      schemaVersion: '2.1.0',
      radiators: [],
      hddCages: [],
      gpuOrientation: 'HORIZONTAL',
      componentRevisions: [
        { partId: syntheticCase.partId, hardwareRevision: 'R1' },
        { partId: syntheticPsu.partId, hardwareRevision: 'P1' },
      ],
      installedBiosVersion: 'F12',
    };
    const exactRecord = {
      schemaVersion: '4.0.0',
      evidenceId: 'synthetic-exact-failure',
      status: 'APPROVED',
      visibility: 'PUBLIC',
      redaction: 'NONE',
      outcome: 'ASSEMBLY_FAILURE',
      issueType: 'PHYSICAL_CLEARANCE',
      parts: [
        { category: 'PC_CASE', partId: syntheticCase.partId, hardwareRevision: 'R1' },
        { category: 'PSU', partId: syntheticPsu.partId, hardwareRevision: 'P1' },
      ],
      exactScope: {
        requiredPartCategories: ['PC_CASE', 'PSU'],
        requiredContextFields: [
          'radiators', 'hddCages', 'gpuOrientation',
          'installedBiosVersion', 'componentRevisions',
        ],
      },
      installationContext: context,
      reportedAt: '2026-09-20T00:00:00.000Z',
      createdByPrincipalId: 'synthetic-writer',
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T01:00:00.000Z',
      moderatedByPrincipalId: 'synthetic-moderator',
      moderatedAt: '2026-09-20T01:00:00.000Z',
    } as const;
    const exact = await checkSynthetic(syntheticRequest(
      [syntheticCase, syntheticPsu],
      [{ capabilityId: 'exact-field-evidence', mode: 'REQUIRED' }],
      {
        installationContext: context,
        evidenceSnapshot: {
          ...emptyFieldEvidenceSnapshot,
          records: [exactRecord],
        },
      },
    ));
    const similar = await checkSynthetic(syntheticRequest(
      [syntheticCase, syntheticPsu],
      [{ capabilityId: 'exact-field-evidence', mode: 'REQUIRED' }],
      {
        installationContext: {
          ...context,
          componentRevisions: [
            { partId: syntheticCase.partId, hardwareRevision: 'R2' },
            { partId: syntheticPsu.partId, hardwareRevision: 'P1' },
          ],
        },
        evidenceSnapshot: {
          ...emptyFieldEvidenceSnapshot,
          records: [exactRecord],
        },
      },
    ));

    expect(exact.resultSnapshot.decision).toBe('BLOCK');
    expect(similar.resultSnapshot).toMatchObject({
      status: 'NOT_CHECKED',
      decision: 'NO_DECISION',
    });
  });

  test('rejects missing durable Knowledge provenance at the service boundary', async () => {
    const invalid = {
      ...knowledgeSnapshot('missing-provenance', 'provider-a', '1.0.0', 'SUPPORTED'),
      sources: [{
        sourceId: 'missing-provenance-source',
        capturedAt: '2026-09-20T00:00:00.000Z',
        evidenceIds: [],
      }],
    } as unknown as KnowledgeSnapshot;

    await expect(checkSynthetic(syntheticRequest(
      [syntheticCpu, syntheticBoard],
      [{ capabilityId: 'cpu-support', mode: 'REQUIRED' }],
      { knowledgeSnapshots: [invalid] },
    ))).rejects.toThrow('durable provenance');
  });
});
