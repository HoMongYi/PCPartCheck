import type { EngineRule, RuleEvaluation } from '@pcpartcheck/core';

import {
  resolveBiosRequirement,
  type BiosRequirementResolution,
} from './knowledge-resolution.js';

function toRuleEvaluation(
  resolution: BiosRequirementResolution,
): RuleEvaluation {
  switch (resolution.kind) {
    case 'NOT_APPLICABLE':
      return {
        status: 'NOT_CHECKED',
        summary: 'Minimum BIOS is not applicable to an unsupported CPU',
        reasons: ['Active Knowledge explicitly marks the CPU unsupported'],
        evidenceIds: [],
        knowledgeRelationIds: resolution.relationIds,
      };
    case 'NONE':
      return {
        status: 'PASS',
        summary: 'No minimum BIOS is required',
        reasons: ['Active Knowledge explicitly states no minimum BIOS'],
        evidenceIds: [],
        knowledgeRelationIds: resolution.relationIds,
      };
    case 'UNKNOWN':
      return {
        status: 'UNKNOWN',
        summary: 'Minimum BIOS compatibility cannot be determined',
        reasons: ['Required BIOS Knowledge or current BIOS is unavailable'],
        evidenceIds: [],
        knowledgeRelationIds: resolution.relationIds,
      };
    case 'SATISFIED':
      return {
        status: 'PASS',
        summary: 'Installed BIOS satisfies the minimum requirement',
        reasons: ['Provider release order places the installed BIOS at or above the minimum'],
        evidenceIds: [],
        knowledgeRelationIds: resolution.relationIds,
      };
    case 'INSUFFICIENT':
      return {
        status: 'INCOMPATIBLE',
        summary: 'Installed BIOS is below the minimum requirement',
        reasons: ['Provider release order places the installed BIOS below the minimum'],
        evidenceIds: [],
        knowledgeRelationIds: resolution.relationIds,
      };
    case 'AMBIGUOUS':
      return {
        status: 'REVIEW_REQUIRED',
        summary: 'Minimum BIOS compatibility is ambiguous',
        reasons: ['Active provider observations cannot be combined unambiguously'],
        evidenceIds: [],
        knowledgeRelationIds: resolution.relationIds,
      };
  }
}

export const minimumBiosRule: EngineRule = {
  ruleId: 'minimum-bios',
  capabilityId: 'bios',
  evaluate: (context) => toRuleEvaluation(resolveBiosRequirement(context)),
};
