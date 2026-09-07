import type {
  CapabilityPolicy,
  EngineRule,
  RuleEvaluation,
} from '@pcpartcheck/core';

import { partsOf } from './parts.js';

export const DEFAULT_CLEARANCE_MARGINS_MM = {
  gpuLength: 10,
  cpuCoolerHeight: 5,
  psuLength: 10,
  radiatorStack: 5,
} as const;

function safetyMargin(policy: CapabilityPolicy, fallback: number): number {
  const configured = policy.config?.safetyMarginMm;
  if (configured === undefined) return fallback;
  if (
    typeof configured !== 'number' ||
    !Number.isFinite(configured) ||
    configured < 0
  ) {
    throw new RangeError('safetyMarginMm must be a non-negative number');
  }
  return configured;
}

function unknown(summary: string): RuleEvaluation {
  return {
    status: 'UNKNOWN',
    summary,
    reasons: ['A required normalized measurement is missing'],
    evidenceIds: [],
  };
}

function evaluateClearance(
  label: string,
  limitMm: number,
  requiredMm: number,
  marginMm: number,
): RuleEvaluation {
  const clearanceMm = limitMm - requiredMm;
  if (clearanceMm < 0) {
    return {
      status: 'INCOMPATIBLE',
      summary: `${label} exceeds available clearance`,
      reasons: [`Required ${requiredMm} mm exceeds ${limitMm} mm by ${-clearanceMm} mm`],
      evidenceIds: [],
    };
  }
  if (clearanceMm < marginMm) {
    return {
      status: 'CONDITIONAL',
      summary: `${label} is below the configured safety margin`,
      reasons: [`Remaining ${clearanceMm} mm is below the ${marginMm} mm margin`],
      conditions: [
        {
          code: 'VERIFY_PHYSICAL_CLEARANCE',
          message: '부품과 케이블을 포함한 실제 여유 공간을 확인하세요.',
        },
      ],
      evidenceIds: [],
    };
  }
  return {
    status: 'PASS',
    summary: `${label} meets the configured safety margin`,
    reasons: [],
    evidenceIds: [],
  };
}

export const gpuClearanceRule: EngineRule = {
  ruleId: 'gpu-clearance',
  capabilityId: 'gpu-clearance',
  evaluate: ({ build, installationContext, policy }) => {
    const [gpu] = partsOf(build.parts, 'GPU');
    const [pcCase] = partsOf(build.parts, 'PC_CASE');
    if (
      !gpu ||
      !pcCase ||
      gpu.spec.lengthMm === undefined ||
      pcCase.spec.maxGpuLengthMm === undefined
    ) {
      return unknown('GPU clearance could not be evaluated');
    }

    const frontStackMm = installationContext.radiators
      .filter((radiator) => radiator.position === 'FRONT')
      .reduce(
        (maximum, radiator) =>
          Math.max(
            maximum,
            radiator.radiatorThicknessMm + radiator.fanThicknessMm,
          ),
        0,
      );
    return evaluateClearance(
      'GPU length',
      pcCase.spec.maxGpuLengthMm - frontStackMm,
      gpu.spec.lengthMm,
      safetyMargin(policy, DEFAULT_CLEARANCE_MARGINS_MM.gpuLength),
    );
  },
};

export const cpuCoolerHeightRule: EngineRule = {
  ruleId: 'cpu-cooler-height',
  capabilityId: 'cooler-clearance',
  evaluate: ({ build, policy }) => {
    const [cooler] = partsOf(build.parts, 'CPU_COOLER');
    const [pcCase] = partsOf(build.parts, 'PC_CASE');
    if (
      !cooler ||
      !pcCase ||
      cooler.spec.heightMm === undefined ||
      pcCase.spec.maxCpuCoolerHeightMm === undefined
    ) {
      return unknown('CPU cooler height could not be evaluated');
    }
    return evaluateClearance(
      'CPU cooler height',
      pcCase.spec.maxCpuCoolerHeightMm,
      cooler.spec.heightMm,
      safetyMargin(policy, DEFAULT_CLEARANCE_MARGINS_MM.cpuCoolerHeight),
    );
  },
};

export const psuLengthRule: EngineRule = {
  ruleId: 'psu-length',
  capabilityId: 'psu-clearance',
  evaluate: ({ build, policy }) => {
    const [psu] = partsOf(build.parts, 'PSU');
    const [pcCase] = partsOf(build.parts, 'PC_CASE');
    if (
      !psu ||
      !pcCase ||
      psu.spec.lengthMm === undefined ||
      pcCase.spec.maxPsuLengthMm === undefined
    ) {
      return unknown('PSU length could not be evaluated');
    }
    return evaluateClearance(
      'PSU length',
      pcCase.spec.maxPsuLengthMm,
      psu.spec.lengthMm,
      safetyMargin(policy, DEFAULT_CLEARANCE_MARGINS_MM.psuLength),
    );
  },
};

export const radiatorMountRule: EngineRule = {
  ruleId: 'radiator-mount',
  capabilityId: 'radiator',
  evaluate: ({ build, installationContext, policy }) => {
    const [pcCase] = partsOf(build.parts, 'PC_CASE');
    const radiators = installationContext.radiators;
    if (radiators.length === 0) {
      const hasUnplacedRadiator = partsOf(build.parts, 'CPU_COOLER').some(
        (cooler) => cooler.spec.radiatorSizeMm !== undefined,
      );
      return hasUnplacedRadiator
        ? unknown('Radiator installation position is missing')
        : {
            status: 'NOT_CHECKED',
            summary: 'No radiator is included in this build',
            reasons: [],
            evidenceIds: [],
          };
    }
    if (!pcCase || !pcCase.spec.radiatorMounts) {
      return unknown('Case radiator mount specifications are missing');
    }

    let conditional: RuleEvaluation | undefined;
    for (const radiator of radiators) {
      const mount = pcCase.spec.radiatorMounts.find(
        (candidate) => candidate.position === radiator.position,
      );
      if (!mount || !mount.supportedSizesMm.includes(radiator.sizeMm)) {
        return {
          status: 'INCOMPATIBLE',
          summary: 'Radiator size is not supported at the selected position',
          reasons: [`${radiator.position} does not support ${radiator.sizeMm} mm`],
          evidenceIds: [],
        };
      }
      if (mount.maxCombinedThicknessMm === undefined) {
        return unknown('Radiator mount thickness limit is missing');
      }

      const result = evaluateClearance(
        'Radiator stack',
        mount.maxCombinedThicknessMm,
        radiator.radiatorThicknessMm + radiator.fanThicknessMm,
        safetyMargin(policy, DEFAULT_CLEARANCE_MARGINS_MM.radiatorStack),
      );
      if (result.status === 'INCOMPATIBLE') return result;
      if (result.status === 'CONDITIONAL') conditional = result;
    }

    return (
      conditional ?? {
        status: 'PASS',
        summary: 'Radiator mounts support the selected installations',
        reasons: [],
        evidenceIds: [],
      }
    );
  },
};

export const cpuCoolerSocketRule: EngineRule = {
  ruleId: 'cpu-cooler-socket',
  capabilityId: 'cooler-socket',
  evaluate: ({ build }) => {
    const [cpu] = partsOf(build.parts, 'CPU');
    const [cooler] = partsOf(build.parts, 'CPU_COOLER');
    if (!cpu || !cooler) return unknown('CPU cooler socket support could not be evaluated');

    if (!cooler.spec.supportedSockets.includes(cpu.spec.socket)) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'CPU cooler does not support the selected socket',
        reasons: [`${cpu.spec.socket} is not in the cooler supported socket list`],
        evidenceIds: [],
      };
    }
    return {
      status: 'PASS',
      summary: 'CPU cooler supports the selected socket',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const clearanceRules = [
  gpuClearanceRule,
  cpuCoolerHeightRule,
  psuLengthRule,
  radiatorMountRule,
  cpuCoolerSocketRule,
] as const;
