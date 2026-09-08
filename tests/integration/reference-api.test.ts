import { describe, expect, test } from 'vitest';

import * as referenceApi from '../../apps/reference-api/src/services.js';

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
});
