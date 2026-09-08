import { describe, expect, test } from 'vitest';

import * as referenceApi from '../../apps/reference-api/src/services.js';
import { buildReferenceServer } from '../../apps/reference-api/src/server.js';

describe('reference API composition', () => {
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
    expect(modes.get('socket')).toBe('REQUIRED');
    expect(modes.get('gpu-clearance')).toBe('REQUIRED');
    expect(modes.get('pcie-bandwidth')).toBe('ADVISORY');
    expect(modes.get('rgb')).toBe('ADVISORY');
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
});
