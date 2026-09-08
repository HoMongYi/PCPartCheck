import {
  CANONICAL_SCHEMA_VERSION,
  INSTALLATION_CONTEXT_SCHEMA_VERSION,
  createCompatibilityEngine,
  type EngineRule,
} from '@pcpartcheck/core';
import {
  DEMO_FIELD_EVIDENCE_RECORDS,
  DEMO_SCENARIOS,
  DEMO_SIMILARITY_QUERY,
} from '@pcpartcheck/demo-data';
import { powerRules } from '@pcpartcheck/power';
import {
  advisoryRules,
  clearanceRules,
  platformRules,
  storageRules,
} from '@pcpartcheck/rules-standard';
import { rankSimilarFieldEvidence } from '@pcpartcheck/similarity';
import { describe, expect, test } from 'vitest';

const allRules: readonly EngineRule[] = [
  ...platformRules,
  ...clearanceRules,
  ...storageRules,
  ...powerRules,
  ...advisoryRules,
];
const rulesById = new Map(allRules.map((rule) => [rule.ruleId, rule]));

describe('synthetic demo scenarios', () => {
  test.each(DEMO_SCENARIOS)('$id produces its documented engine result', async (scenario) => {
    const rules = scenario.ruleIds.map((ruleId) => {
      const rule = rulesById.get(ruleId);
      if (!rule) throw new Error(`Unknown demo rule: ${ruleId}`);
      return rule;
    });
    const engine = createCompatibilityEngine({
      rules,
      versions: {
        engineVersion: '0.1.0',
        ruleSetVersion: '0.1.0',
        canonicalSchemaVersion: CANONICAL_SCHEMA_VERSION,
        installationContextSchemaVersion: INSTALLATION_CONTEXT_SCHEMA_VERSION,
        identityMapperVersion: '1.0.0',
        providerVersions: [{ providerId: 'synthetic-demo', providerVersion: '1.0.0' }],
      },
      clock: () => new Date('2026-09-08T00:00:00.000Z'),
    });

    const snapshot = await engine.check(scenario.input);

    expect(snapshot.resultSnapshot).toMatchObject(scenario.expectedResult);
  });

  test('publishes three reference-only similar failures', () => {
    const results = rankSimilarFieldEvidence({
      query: DEMO_SIMILARITY_QUERY,
      records: DEMO_FIELD_EVIDENCE_RECORDS,
    });

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result).toEqual({
        evidenceId: expect.any(String),
        issueType: 'PHYSICAL_CLEARANCE',
        similarityScore: expect.any(Number),
        matchedFields: expect.any(Array),
        differences: expect.any(Array),
        reason: expect.any(String),
      });
      expect(result).not.toHaveProperty('status');
      expect(result).not.toHaveProperty('decision');
    }
  });
});
