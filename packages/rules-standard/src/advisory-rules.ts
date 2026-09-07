import type { EngineRule, RuleEvaluation } from '@pcpartcheck/core';

import { partsOf } from './parts.js';

function unknown(summary: string, reason: string): RuleEvaluation {
  return {
    status: 'UNKNOWN',
    summary,
    reasons: [reason],
    evidenceIds: [],
  };
}

function poweredHub(summary: string, reason: string): RuleEvaluation {
  return {
    status: 'CONDITIONAL',
    summary,
    reasons: [reason],
    conditions: [
      {
        code: 'USE_POWERED_FAN_HUB',
        message: 'Use a powered fan hub instead of drawing all fan power from motherboard headers',
      },
    ],
    evidenceIds: [],
  };
}

export const fanHeaderCountRule: EngineRule = {
  ruleId: 'fan-header-count',
  capabilityId: 'fan-headers',
  evaluate: ({ build }) => {
    const fans = partsOf(build.parts, 'CASE_FAN');
    if (fans.length === 0) {
      return {
        status: 'NOT_CHECKED',
        summary: 'No case fans require evaluation',
        reasons: [],
        evidenceIds: [],
      };
    }

    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!motherboard?.spec.fanHeaders) {
      return unknown('Fan header count could not be evaluated', 'Motherboard fan header data is missing');
    }

    const availableHeaders = motherboard.spec.fanHeaders
      .filter((header) => header.type === 'SYSTEM_FAN' || header.type === 'CPU_OPT')
      .reduce((total, header) => total + header.count, 0);

    if (fans.length > availableHeaders) {
      return poweredHub(
        'Case fan count exceeds available motherboard headers',
        `${fans.length} fans require more than ${availableHeaders} available headers`,
      );
    }

    return {
      status: 'PASS',
      summary: 'Motherboard has enough fan headers',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const fanHeaderCurrentRule: EngineRule = {
  ruleId: 'fan-header-current',
  capabilityId: 'fan-headers',
  evaluate: ({ build }) => {
    const fans = partsOf(build.parts, 'CASE_FAN');
    if (fans.length === 0) {
      return {
        status: 'NOT_CHECKED',
        summary: 'No case fan current requires evaluation',
        reasons: [],
        evidenceIds: [],
      };
    }

    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    const headers = motherboard?.spec.fanHeaders?.filter(
      (header) => header.type === 'SYSTEM_FAN' || header.type === 'CPU_OPT',
    );
    if (
      !headers ||
      headers.length === 0 ||
      fans.some((fan) => fan.spec.maxCurrentA === undefined) ||
      headers.some((header) => header.maxCurrentA === undefined)
    ) {
      return unknown(
        'Fan header current could not be evaluated',
        'Fan or motherboard header current rating is missing',
      );
    }

    const fanLoads = fans
      .map((fan) => fan.spec.maxCurrentA ?? 0)
      .sort((left, right) => right - left);
    const headerCapacities = headers
      .flatMap((header) =>
        Array.from({ length: header.count }, () => header.maxCurrentA ?? 0),
      )
      .sort((left, right) => right - left);
    const hasDirectAssignment =
      fanLoads.length <= headerCapacities.length &&
      fanLoads.every(
        (fanCurrentA, index) => fanCurrentA <= (headerCapacities[index] ?? 0),
      );

    if (!hasDirectAssignment) {
      return poweredHub(
        'Case fan current cannot be assigned within individual header ratings',
        'At least one fan lacks a dedicated header with sufficient current capacity',
      );
    }

    return {
      status: 'PASS',
      summary: 'Fan current is within motherboard header capacity',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const rgbHeaderRule: EngineRule = {
  ruleId: 'rgb-header',
  capabilityId: 'rgb',
  evaluate: ({ build }) => {
    const rgbFans = partsOf(build.parts, 'CASE_FAN').filter(
      (fan) => fan.spec.rgbConnector !== undefined,
    );
    if (rgbFans.length === 0) {
      return {
        status: 'NOT_CHECKED',
        summary: 'No case fan RGB connectors require evaluation',
        reasons: [],
        evidenceIds: [],
      };
    }

    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!motherboard?.spec.rgbHeaders) {
      return unknown('RGB headers could not be evaluated', 'Motherboard RGB header data is missing');
    }

    const required = new Map<string, number>();
    for (const fan of rgbFans) {
      const connector = fan.spec.rgbConnector;
      if (connector) required.set(connector, (required.get(connector) ?? 0) + 1);
    }
    const available = new Map<string, number>();
    for (const header of motherboard.spec.rgbHeaders) {
      available.set(header.type, (available.get(header.type) ?? 0) + header.count);
    }

    const shortage = [...required].find(
      ([connector, count]) => (available.get(connector) ?? 0) < count,
    );
    if (shortage) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'RGB connector voltage or pin layout is not directly compatible',
        reasons: [
          `${shortage[1]} ${shortage[0]} connector(s) require matching motherboard headers`,
        ],
        evidenceIds: [],
      };
    }

    return {
      status: 'PASS',
      summary: 'RGB connector voltage and pin layout match',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const memoryDataRateAdvisoryRule: EngineRule = {
  ruleId: 'memory-data-rate-advisory',
  capabilityId: 'memory-rate',
  evaluate: ({ build }) => {
    const memories = partsOf(build.parts, 'MEMORY');
    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (memories.length === 0 || !motherboard) {
      return unknown('Memory data rate could not be evaluated', 'Memory or motherboard is missing');
    }
    if (
      motherboard.spec.supportedDataRatesMtps === undefined ||
      memories.some((memory) => memory.spec.dataRateMtps === undefined)
    ) {
      return unknown(
        'Memory data rate could not be evaluated',
        'Canonical memory data rate support is incomplete',
      );
    }

    const unsupported = memories.find(
      (memory) =>
        !motherboard.spec.supportedDataRatesMtps?.includes(
          memory.spec.dataRateMtps ?? -1,
        ),
    );
    if (unsupported) {
      return {
        status: 'WARNING',
        summary: 'Requested memory data rate is not listed by the motherboard',
        reasons: [`${unsupported.spec.dataRateMtps} MT/s is not in the supported data rate list`],
        evidenceIds: [],
      };
    }

    return {
      status: 'PASS',
      summary: 'Requested memory data rate is listed by the motherboard',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const fourDimmDataRateRule: EngineRule = {
  ruleId: 'four-dimm-data-rate',
  capabilityId: 'four-dimm-rate',
  evaluate: ({ build, policy }) => {
    const memories = partsOf(build.parts, 'MEMORY');
    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (memories.length === 0 || !motherboard) {
      return unknown('Four-DIMM data rate could not be evaluated', 'Memory or motherboard is missing');
    }

    const moduleCount = memories.reduce(
      (total, memory) => total + memory.spec.moduleCount,
      0,
    );
    if (moduleCount < 4) {
      return {
        status: 'PASS',
        summary: 'Four-DIMM data rate guidance does not apply',
        reasons: [],
        evidenceIds: [],
      };
    }

    const threshold = policy.config?.stableFourDimmDataRateMtps;
    if (
      typeof threshold !== 'number' ||
      threshold <= 0 ||
      memories.some((memory) => memory.spec.dataRateMtps === undefined)
    ) {
      return unknown(
        'Four-DIMM data rate could not be evaluated',
        'Profile threshold or canonical memory data rate is missing',
      );
    }

    const requestedDataRateMtps = Math.max(
      ...memories.map((memory) => memory.spec.dataRateMtps ?? 0),
    );
    if (requestedDataRateMtps > threshold) {
      return {
        status: 'WARNING',
        summary: 'Four-DIMM configuration exceeds the profile stability threshold',
        reasons: [`${requestedDataRateMtps} MT/s exceeds the ${threshold} MT/s profile threshold`],
        evidenceIds: [],
      };
    }

    return {
      status: 'PASS',
      summary: 'Four-DIMM data rate is within the profile threshold',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const advisoryRules = [
  fanHeaderCountRule,
  fanHeaderCurrentRule,
  rgbHeaderRule,
  memoryDataRateAdvisoryRule,
  fourDimmDataRateRule,
] as const;
