import type {
  EngineRule,
  PowerAdapterRequirement,
  PowerConnectorRequirement,
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

interface PowerConsumer {
  readonly partId: string;
  readonly requirements: readonly PowerConnectorRequirement[] | undefined;
  readonly adapters: readonly PowerAdapterRequirement[];
}

function powerConsumers(
  parts: Parameters<EngineRule['evaluate']>[0]['build']['parts'],
): readonly PowerConsumer[] {
  return parts.flatMap((part) => {
    switch (part.category) {
      case 'GPU':
      case 'PCIE_CARD':
        return [{
          partId: part.partId,
          requirements: part.spec.powerConnectorRequirements,
          adapters: part.spec.powerAdapterRequirements ?? [],
        }];
      case 'MOTHERBOARD':
        return [{
          partId: part.partId,
          requirements: part.spec.powerConnectorRequirements,
          adapters: [],
        }];
      default:
        return [];
    }
  });
}

function take(
  available: Map<PowerConnectorType, number>,
  type: PowerConnectorType,
  count: number,
): boolean {
  const current = available.get(type) ?? 0;
  if (current < count) return false;
  available.set(type, current - count);
  return true;
}

export const psuConnectorRule: EngineRule = {
  ruleId: 'psu-connectors',
  capabilityId: 'psu-connector',
  evaluate: ({ build, installationContext, policy }) => {
    const [psu] = byCategory(build.parts, 'PSU');
    if (!psu) {
      return {
        status: 'UNKNOWN',
        summary: 'PSU connector delivery could not be evaluated',
        reasons: ['PSU is missing'],
        evidenceIds: [],
      };
    }

    if (psu.spec.powerConnectors === undefined) {
      return {
        status: 'UNKNOWN',
        summary: 'PSU connector inventory is missing',
        reasons: ['Known no connectors must be represented by an empty list'],
        evidenceIds: [],
      };
    }
    const provided = connectorCounts(psu.spec.powerConnectors);
    const consumers = powerConsumers(build.parts);
    const pciePower = installationContext.pciePower;
    if (consumers.some(({ requirements }) => requirements === undefined)) {
      return {
        status: 'UNKNOWN',
        summary: 'Component power connector requirements are missing',
        reasons: ['Known no connector requirement must be represented by an empty list'],
        evidenceIds: [],
      };
    }
    const adapterConditions = [];
    const declaredConditions = [];
    const optionalMissing: string[] = [];

    for (const mode of ['REQUIRED', 'CONDITIONAL', 'OPTIONAL'] as const) {
      for (const consumer of consumers) {
        for (const requirement of (consumer.requirements ?? []).filter(
          (candidate) => candidate.mode === mode,
        )) {
          if (take(provided, requirement.type, requirement.count)) {
            const independentCableCount = pciePower?.independentCableCount;
            if (
              requirement.independentCableCount !== undefined &&
              independentCableCount === undefined
            ) {
              return {
                status: 'UNKNOWN',
                summary: 'Independent PCIe power cable facts are missing',
                reasons: ['The required cable count cannot be checked'],
                evidenceIds: [],
              };
            }
            if (
              requirement.independentCableCount !== undefined &&
              independentCableCount !== undefined &&
              independentCableCount <
                requirement.independentCableCount
            ) {
              return {
                status: 'INCOMPATIBLE',
                summary: 'Independent PCIe power cable requirement is not met',
                reasons: [
                  `${requirement.independentCableCount} independent cables are required by technical data`,
                ],
                evidenceIds: [],
              };
            }
            continue;
          }

          if (mode === 'OPTIONAL') {
            optionalMissing.push(`${requirement.type} x${requirement.count}`);
            continue;
          }
          if (mode === 'CONDITIONAL') {
            if (!requirement.condition) {
              return {
                status: 'UNKNOWN',
                summary: 'Conditional power connector requirement is incomplete',
                reasons: [`${requirement.type} has no documented condition`],
                evidenceIds: [],
              };
            }
            declaredConditions.push(requirement.condition);
            continue;
          }

          const highPowerConnector =
            requirement.type === 'PCIE_12V_2X6' ||
            requirement.type === 'PCIE_12VHPWR';
          const adapterUsed = pciePower?.adapterUsed;
          if (
            highPowerConnector &&
            adapterUsed === undefined
          ) {
            return {
              status: 'UNKNOWN',
              summary: 'High-power connector installation facts are missing',
              reasons: ['Native cable or documented adapter use is not declared'],
              evidenceIds: [],
            };
          }
          if (highPowerConnector && adapterUsed === true) {
            const adapter = consumer.adapters.find(
              (candidate) =>
                candidate.outputType === requirement.type &&
                candidate.outputCount >= requirement.count,
            );
            if (!adapter) {
              return {
                status: 'UNKNOWN',
                summary: 'Power adapter input requirements are missing',
                reasons: ['Adapter use is declared without technical input requirements'],
                evidenceIds: [],
              };
            }
            if (!take(provided, adapter.inputType, adapter.inputCount)) {
              return {
                status: 'INCOMPATIBLE',
                summary: 'PSU cannot satisfy the documented adapter inputs',
                reasons: [`Adapter requires ${adapter.inputType} x${adapter.inputCount}`],
                evidenceIds: [],
              };
            }
            const independentCableCount = pciePower?.independentCableCount;
            if (
              adapter.independentCableCount !== undefined &&
              independentCableCount === undefined
            ) {
              return {
                status: 'UNKNOWN',
                summary: 'Adapter independent cable facts are missing',
                reasons: ['The documented adapter cable count cannot be checked'],
                evidenceIds: [],
              };
            }
            if (
              adapter.independentCableCount !== undefined &&
              independentCableCount !== undefined &&
              independentCableCount <
                adapter.independentCableCount
            ) {
              return {
                status: 'INCOMPATIBLE',
                summary: 'Adapter independent cable requirement is not met',
                reasons: [
                  `Adapter requires ${adapter.independentCableCount} independent cables`,
                ],
                evidenceIds: [],
              };
            }
            adapterConditions.push({
              code: 'VERIFY_GPU_POWER_ADAPTER',
              message: '기술 자료에 명시된 어댑터와 독립 케이블 연결을 확인하세요.',
            });
            continue;
          }

          return {
            status: 'INCOMPATIBLE',
            summary: 'PSU does not provide all required power connectors',
            reasons: [`${requirement.type} requires ${requirement.count}`],
            evidenceIds: [],
          };
        }
      }
    }

    const conditions = [...adapterConditions, ...declaredConditions];
    if (conditions.length > 0) {
      return {
        status: 'CONDITIONAL',
        summary: 'Power delivery depends on documented installation conditions',
        reasons: ['One or more conditional power paths require verification'],
        conditions,
        evidenceIds: [],
      };
    }
    if (
      optionalMissing.length > 0 &&
      policy.config?.warnOnOptionalConnectorMissing === true
    ) {
      return {
        status: 'WARNING',
        summary: 'Optional power connectors are not available',
        reasons: optionalMissing,
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
