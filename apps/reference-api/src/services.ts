import type {
  DemoDashboardResponse,
  PcPartCheckApiServices,
} from '@pcpartcheck/api-contracts';
import {
  CANONICAL_SCHEMA_VERSION,
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

const allRules: readonly EngineRule[] = [
  ...platformRules,
  ...clearanceRules,
  ...storageRules,
  ...powerRules,
  ...advisoryRules,
];
const rulesById = new Map(allRules.map((rule) => [rule.ruleId, rule]));

const versions = {
  engineVersion: '0.1.0',
  ruleSetVersion: '0.1.0',
  canonicalSchemaVersion: CANONICAL_SCHEMA_VERSION,
  identityMapperVersion: '1.0.0',
  providerVersions: [
    { providerId: 'synthetic-demo', providerVersion: '1.0.0' },
  ],
} as const;

function selectRules(ruleIds: readonly string[]): readonly EngineRule[] {
  return ruleIds.map((ruleId) => {
    const rule = rulesById.get(ruleId);
    if (!rule) throw new Error(`Unknown demo rule: ${ruleId}`);
    return rule;
  });
}

async function getDemoDashboard(): Promise<DemoDashboardResponse> {
  const scenarios = await Promise.all(
    DEMO_SCENARIOS.map(async (scenario) => {
      const engine = createCompatibilityEngine({
        rules: selectRules(scenario.ruleIds),
        versions,
      });
      const { resultSnapshot } = await engine.check(scenario.input);
      return {
        id: scenario.id,
        title: scenario.title,
        summary: scenario.summary,
        status: resultSnapshot.status,
        decision: resultSnapshot.decision,
        blockingRuleIds: [...resultSnapshot.issues.blockingRuleIds],
        advisoryRuleIds: [...resultSnapshot.issues.advisoryRuleIds],
      };
    }),
  );

  return {
    scenarios,
    similarEvidence: rankSimilarFieldEvidence({
      query: DEMO_SIMILARITY_QUERY,
      records: DEMO_FIELD_EVIDENCE_RECORDS,
    }).map((match) => ({
      ...match,
      matchedFields: [...match.matchedFields],
      differences: [...match.differences],
    })),
  };
}

export function createReferenceApiServices(): PcPartCheckApiServices {
  const engine = createCompatibilityEngine({ rules: allRules, versions });

  return {
    checkCompatibility: (request) => engine.check(request),
    findSimilarEvidence: (request) =>
      Promise.resolve(rankSimilarFieldEvidence(request)),
    getDemoDashboard,
  };
}
