import { describe, expect, test } from 'vitest';

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
    const installationContext = { schemaVersion: '2.0.0' as const };
    const visibilities = ['PUBLIC', 'STAFF_ONLY', 'ADMIN_ONLY'] as const;
    for (const [index, visibility] of visibilities.entries()) {
      const evidenceId = `scope-${visibility.toLocaleLowerCase('en-US')}`;
      await services.createFieldEvidence(
        {
          evidenceId,
          visibility,
          redaction: 'NONE',
          outcome: 'ASSEMBLY_FAILURE',
          issueType: 'STORAGE_RESOURCE',
          parts: [{
            category: 'STORAGE',
            partId: `30000000-0000-4000-8000-00000000000${index + 1}`,
          }],
          installationContext,
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

    expect(dashboard.scenarios).toHaveLength(8);
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
      'power-budget', 'psu-connector',
    ]) {
      expect(modes.get(capabilityId)).toBe('REQUIRED');
    }
    for (const capabilityId of [
      'pcie-bandwidth', 'fan-headers', 'rgb', 'memory-rate', 'four-dimm-rate',
    ]) {
      expect(modes.get(capabilityId)).toBe('ADVISORY');
    }
    for (const capabilityId of [
      'manufacturer-specification', 'cpu-support', 'bios', 'qvl',
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
