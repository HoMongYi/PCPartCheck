import type { EngineRule, RuleEvaluation } from '@pcpartcheck/core';

import { partsOf } from './parts.js';

function unknown(): RuleEvaluation {
  return {
    status: 'UNKNOWN',
    summary: 'PSU form factor could not be evaluated',
    reasons: ['Case support or PSU form factor is missing'],
    evidenceIds: [],
  };
}

export const psuFormFactorRule: EngineRule = {
  ruleId: 'psu-form-factor',
  capabilityId: 'psu-form-factor',
  evaluate: ({ build }) => {
    const [pcCase] = partsOf(build.parts, 'PC_CASE');
    const [psu] = partsOf(build.parts, 'PSU');
    if (
      pcCase === undefined ||
      psu === undefined ||
      pcCase.spec.supportedPsuFormFactors === undefined ||
      psu.spec.formFactor === undefined
    ) {
      return unknown();
    }

    if (!pcCase.spec.supportedPsuFormFactors.includes(psu.spec.formFactor)) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'Case does not support the PSU form factor',
        reasons: [
          `${psu.spec.formFactor} is not in the case supported PSU form factor list`,
        ],
        evidenceIds: [],
      };
    }

    return {
      status: 'PASS',
      summary: 'Case supports the PSU form factor',
      reasons: [],
      evidenceIds: [],
    };
  },
};
