import type {
  CapabilityResponseItem,
  DemoDashboardResponse,
  FieldEvidencePatch,
  PartsQuery,
  PcPartCheckApiServices,
} from '@pcpartcheck/api-contracts';
import {
  CANONICAL_SCHEMA_VERSION,
  createCompatibilityEngine,
  type CanonicalPart,
  type EngineRule,
  type PolicyProfile,
} from '@pcpartcheck/core';
import {
  DEMO_FIELD_EVIDENCE_RECORDS,
  DEMO_SCENARIOS,
  DEMO_SIMILARITY_QUERY,
} from '@pcpartcheck/demo-data';
import type { FieldEvidenceRecord } from '@pcpartcheck/evidence';
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
  identityMapperVersion: '1.1.0',
  providerVersions: [
    { providerId: 'synthetic-demo', providerVersion: '1.0.0' },
  ],
} as const;

const partCatalog = new Map<string, CanonicalPart>();
for (const scenario of DEMO_SCENARIOS) {
  for (const part of scenario.input.build.parts) partCatalog.set(part.partId, part);
}

const capabilities: readonly CapabilityResponseItem[] = [
  ...new Map(
    allRules.map((rule) => [
      rule.capabilityId,
      {
        capabilityId: rule.capabilityId,
        title: rule.capabilityId
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
      },
    ]),
  ).values(),
].sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));

const profiles: readonly PolicyProfile[] = [
  {
    profileId: 'reference-default',
    policyVersion: '1.0.0',
    capabilities: capabilities.map(({ capabilityId }) => ({
      capabilityId,
      mode: 'REQUIRED',
    })),
  },
];

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

function matchesPartQuery(part: CanonicalPart, query: PartsQuery): boolean {
  if (query.category && part.category !== query.category) return false;
  if (query.manufacturer) {
    if (part.manufacturer.toLocaleLowerCase('en-US') !==
      query.manufacturer.toLocaleLowerCase('en-US')) return false;
  }
  if (query.search) {
    const haystack = `${part.manufacturer} ${part.model} ${part.mpn ?? ''}`
      .toLocaleLowerCase('en-US');
    if (!haystack.includes(query.search.toLocaleLowerCase('en-US'))) return false;
  }
  return true;
}

export function createReferenceApiServices(): PcPartCheckApiServices {
  const engine = createCompatibilityEngine({ rules: allRules, versions });
  const fieldEvidence = new Map(
    DEMO_FIELD_EVIDENCE_RECORDS.map((record) => [
      record.evidenceId,
      structuredClone(record),
    ]),
  );

  return {
    checkCompatibility: (request) => engine.check(request),
    checkCompatibilityBatch: async ({ requests }) => ({
      results: await Promise.all(requests.map((request) => engine.check(request))),
    }),
    listParts: async (query) => {
      const items = [...partCatalog.values()]
        .filter((part) => matchesPartQuery(part, query))
        .sort((left, right) => left.partId.localeCompare(right.partId));
      return { items, total: items.length };
    },
    getPart: async (partId) => partCatalog.get(partId),
    getEvidence: async (evidenceId) => fieldEvidence.get(evidenceId),
    findSimilarEvidence: async (query) =>
      rankSimilarFieldEvidence({
        query,
        records: [...fieldEvidence.values()].filter(
          (record) => record.visibility === 'PUBLIC',
        ),
      }),
    listCapabilities: async () => capabilities,
    listProfiles: async () => profiles,
    createFieldEvidence: async (record) => {
      if (fieldEvidence.has(record.evidenceId)) {
        throw new Error(`Field evidence already exists: ${record.evidenceId}`);
      }
      const created = structuredClone(record);
      fieldEvidence.set(created.evidenceId, created);
      return created;
    },
    patchFieldEvidence: async (evidenceId, patch: FieldEvidencePatch) => {
      const current = fieldEvidence.get(evidenceId);
      if (!current) return undefined;
      const updated = { ...current, ...structuredClone(patch) } as FieldEvidenceRecord;
      fieldEvidence.set(evidenceId, updated);
      return updated;
    },
    approveFieldEvidence: async (evidenceId) => {
      const current = fieldEvidence.get(evidenceId);
      if (!current) return undefined;
      const approved: FieldEvidenceRecord = { ...current, status: 'APPROVED' };
      fieldEvidence.set(evidenceId, approved);
      return approved;
    },
    getDemoDashboard,
  };
}
