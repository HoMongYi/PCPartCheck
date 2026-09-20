import type { EngineRule, RuleEvaluation } from '@pcpartcheck/core';

import {
  resolveCpuSupport,
  type CpuSupportResolution,
} from './knowledge-resolution.js';

function toRuleEvaluation(
  resolution: CpuSupportResolution,
): RuleEvaluation {
  switch (resolution.kind) {
    case 'SUPPORTED':
      return {
        status: 'PASS',
        summary: 'CPU is explicitly supported by active Knowledge',
        reasons: ['Active Knowledge contains explicit CPU support'],
        evidenceIds: [],
        knowledgeRelationIds: resolution.relationIds,
      };
    case 'UNSUPPORTED':
      return {
        status: 'INCOMPATIBLE',
        summary: 'CPU is explicitly unsupported by active Knowledge',
        reasons: ['Active Knowledge contains explicit CPU non-support'],
        evidenceIds: [],
        knowledgeRelationIds: resolution.relationIds,
      };
    case 'CONFLICT':
      return {
        status: 'REVIEW_REQUIRED',
        summary: 'Active Knowledge conflicts on CPU support',
        reasons: ['Explicit support and non-support observations conflict'],
        evidenceIds: [],
        knowledgeRelationIds: resolution.relationIds,
      };
    case 'MISSING':
      return {
        status: 'UNKNOWN',
        summary: 'CPU support Knowledge is unavailable',
        reasons: ['No applicable explicit CPU support relation was found'],
        evidenceIds: [],
      };
  }
}

export const cpuSupportRule: EngineRule = {
  ruleId: 'cpu-support',
  capabilityId: 'cpu-support',
  evaluate: (context) => toRuleEvaluation(resolveCpuSupport(context)),
};
