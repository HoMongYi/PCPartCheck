import type {
  EngineRule,
  PowerConnectorSpec,
  PowerConnectorType,
} from '@pcpartcheck/core';

import { calculatePowerBudget } from './power-budget.js';

function byCategory<TCategory extends 'GPU' | 'MOTHERBOARD' | 'PSU'>(
  parts: Parameters<EngineRule['evaluate']>[0]['build']['parts'],
  category: TCategory,
) {
  return parts.filter(
    (part): part is Extract<(typeof parts)[number], { category: TCategory }> =>
      part.category === category,
  );
}

export const psuCapacityRule: EngineRule = {
  ruleId: 'psu-capacity',
  capabilityId: 'power-budget',
  evaluate: ({ build }) => {
    const [psu] = byCategory(build.parts, 'PSU');
    if (!psu) {
      return {
        status: 'UNKNOWN',
        summary: 'PSU capacity could not be evaluated',
        reasons: ['PSU is missing'],
        evidenceIds: [],
      };
    }
    const budget = calculatePowerBudget(build);
    if (budget.status === 'UNKNOWN') {
      return {
        status: 'UNKNOWN',
        summary: 'Power budget could not be calculated',
        reasons: ['CPU or GPU peak power is missing'],
        evidenceIds: budget.evidence.map(({ evidenceId }) => evidenceId),
      };
    }
    const evidenceIds = budget.evidence.map(({ evidenceId }) => evidenceId);
    if (psu.spec.ratedPowerW < budget.minimumPsuW) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'PSU capacity is below the calculated hard minimum',
        reasons: [`${psu.spec.ratedPowerW} W is below ${budget.minimumPsuW} W`],
        evidenceIds,
      };
    }
    if (psu.spec.ratedPowerW < budget.recommendedPsuW) {
      return {
        status: 'WARNING',
        summary: 'PSU capacity is below the recommended value',
        reasons: [`${psu.spec.ratedPowerW} W is below ${budget.recommendedPsuW} W`],
        evidenceIds,
      };
    }
    return {
      status: 'PASS',
      summary: 'PSU capacity meets the recommended value',
      reasons: [],
      evidenceIds,
    };
  },
};

function connectorCounts(connectors: readonly PowerConnectorSpec[]) {
  const counts = new Map<PowerConnectorType, number>();
  for (const connector of connectors) {
    counts.set(connector.type, (counts.get(connector.type) ?? 0) + connector.count);
  }
  return counts;
}

export const psuConnectorRule: EngineRule = {
  ruleId: 'psu-connectors',
  capabilityId: 'psu-connector',
  evaluate: ({ build, installationContext }) => {
    const [psu] = byCategory(build.parts, 'PSU');
    if (!psu) {
      return {
        status: 'UNKNOWN',
        summary: 'PSU connector delivery could not be evaluated',
        reasons: ['PSU is missing'],
        evidenceIds: [],
      };
    }

    const requirements = [
      ...byCategory(build.parts, 'GPU').flatMap(
        ({ spec }) => spec.powerConnectors ?? [],
      ),
      ...byCategory(build.parts, 'MOTHERBOARD').flatMap(
        ({ spec }) => spec.powerConnectors ?? [],
      ),
    ];
    const required = connectorCounts(requirements);
    const provided = connectorCounts(psu.spec.powerConnectors);
    let adapterRequired = false;

    for (const [type, count] of required) {
      const available = provided.get(type) ?? 0;
      if (available >= count) continue;

      const adapterEligible =
        (type === 'PCIE_12V_2X6' || type === 'PCIE_12VHPWR') &&
        installationContext.pciePower.adapterUsed &&
        (provided.get('PCIE_8_PIN') ?? 0) >= (count - available) * 2;
      if (adapterEligible) {
        adapterRequired = true;
        continue;
      }
      return {
        status: 'INCOMPATIBLE',
        summary: 'PSU does not provide all required power connectors',
        reasons: [`${type} requires ${count}, PSU provides ${available}`],
        evidenceIds: [],
      };
    }

    const requiredPcie8 = required.get('PCIE_8_PIN') ?? 0;
    if (
      requiredPcie8 > 0 &&
      installationContext.pciePower.independentCableCount < requiredPcie8
    ) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'Independent PCIe power cable count is insufficient',
        reasons: [`${requiredPcie8} independent cables are required`],
        evidenceIds: [],
      };
    }

    if (adapterRequired) {
      return {
        status: 'CONDITIONAL',
        summary: 'GPU power delivery requires an adapter',
        reasons: ['A native high-power GPU connector is not available'],
        conditions: [
          {
            code: 'VERIFY_GPU_POWER_ADAPTER',
            message: '어댑터 규격과 독립 PCIe 케이블 연결 조건을 확인하세요.',
          },
        ],
        evidenceIds: [],
      };
    }
    return {
      status: 'PASS',
      summary: 'PSU provides the required power connectors',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const powerRules = [psuCapacityRule, psuConnectorRule] as const;
