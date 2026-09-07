import type { EngineRule, RuleEvaluation } from '@pcpartcheck/core';

import { partsOf } from './parts.js';

function missing(summary: string): RuleEvaluation {
  return {
    status: 'UNKNOWN',
    summary,
    reasons: ['Required canonical part or specification is missing'],
    evidenceIds: [],
  };
}

export const cpuSocketRule: EngineRule = {
  ruleId: 'cpu-socket',
  capabilityId: 'socket',
  evaluate: ({ build }) => {
    const [cpu] = partsOf(build.parts, 'CPU');
    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!cpu || !motherboard) return missing('CPU socket could not be evaluated');

    if (cpu.spec.socket !== motherboard.spec.socket) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'CPU and motherboard sockets differ',
        reasons: [`${cpu.spec.socket} does not match ${motherboard.spec.socket}`],
        evidenceIds: [],
      };
    }

    return {
      status: 'PASS',
      summary: 'CPU and motherboard sockets match',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const memoryGenerationRule: EngineRule = {
  ruleId: 'memory-generation',
  capabilityId: 'memory-generation',
  evaluate: ({ build }) => {
    const memoryParts = partsOf(build.parts, 'MEMORY');
    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!motherboard || memoryParts.length === 0) {
      return missing('Memory generation could not be evaluated');
    }

    const unsupported = memoryParts.find(
      (memory) =>
        !motherboard.spec.memoryTechnologies.includes(memory.spec.technology),
    );
    if (unsupported) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'Memory generation is not supported by the motherboard',
        reasons: [
          `${unsupported.spec.technology} is not in the motherboard supported list`,
        ],
        evidenceIds: [],
      };
    }

    return {
      status: 'PASS',
      summary: 'Memory generation is supported',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const memoryCapacityRule: EngineRule = {
  ruleId: 'memory-capacity',
  capabilityId: 'memory-capacity',
  evaluate: ({ build }) => {
    const memoryParts = partsOf(build.parts, 'MEMORY');
    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!motherboard || memoryParts.length === 0) {
      return missing('Memory capacity could not be evaluated');
    }

    const moduleCount = memoryParts.reduce(
      (total, memory) => total + memory.spec.moduleCount,
      0,
    );
    const capacityGb = memoryParts.reduce(
      (total, memory) =>
        total + memory.spec.moduleCount * memory.spec.capacityPerModuleGb,
      0,
    );

    if (
      motherboard.spec.memorySlots !== undefined &&
      moduleCount > motherboard.spec.memorySlots
    ) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'Memory module count exceeds motherboard slots',
        reasons: [`${moduleCount} modules require more than ${motherboard.spec.memorySlots} slots`],
        evidenceIds: [],
      };
    }
    if (
      motherboard.spec.maxMemoryGb !== undefined &&
      capacityGb > motherboard.spec.maxMemoryGb
    ) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'Memory capacity exceeds motherboard limit',
        reasons: [`${capacityGb} GB exceeds ${motherboard.spec.maxMemoryGb} GB`],
        evidenceIds: [],
      };
    }
    if (
      motherboard.spec.memorySlots === undefined ||
      motherboard.spec.maxMemoryGb === undefined
    ) {
      return missing('Motherboard memory limits are incomplete');
    }

    return {
      status: 'PASS',
      summary: 'Memory count and capacity fit motherboard limits',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const motherboardFormFactorRule: EngineRule = {
  ruleId: 'motherboard-form-factor',
  capabilityId: 'form-factor',
  evaluate: ({ build }) => {
    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    const [pcCase] = partsOf(build.parts, 'PC_CASE');
    if (!motherboard || !pcCase) {
      return missing('Motherboard form factor could not be evaluated');
    }

    if (
      !pcCase.spec.supportedMotherboardFormFactors.includes(
        motherboard.spec.formFactor,
      )
    ) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'Motherboard form factor is not supported by the case',
        reasons: [
          `${motherboard.spec.formFactor} is not in the case supported list`,
        ],
        evidenceIds: [],
      };
    }

    return {
      status: 'PASS',
      summary: 'Motherboard form factor is supported by the case',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const platformRules = [
  cpuSocketRule,
  memoryGenerationRule,
  memoryCapacityRule,
  motherboardFormFactorRule,
] as const;
