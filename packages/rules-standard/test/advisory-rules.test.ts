import type {
  CanonicalPart,
  EngineRule,
  FanHeaderSpec,
  RgbHeaderSpec,
} from '@pcpartcheck/core';
import { aggregateRuleResults } from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as rules from '../src/index.js';
import { context, memory } from './fixtures.js';

function exportedRule(name: string): EngineRule {
  const candidate = (rules as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as EngineRule;
}

function board(options: {
  fanHeaders?: readonly FanHeaderSpec[];
  rgbHeaders?: readonly RgbHeaderSpec[];
  supportedDataRatesMtps?: readonly number[];
}): CanonicalPart {
  return {
    schemaVersion: '1.1.0',
    partId: '22222222-2222-4222-8222-222222222222',
    category: 'MOTHERBOARD',
    manufacturer: 'Example',
    model: 'Board',
    status: 'ACTIVE',
    spec: {
      socket: 'AM5',
      formFactor: 'ATX',
      memoryTechnologies: ['DDR5'],
      ...(options.fanHeaders ? { fanHeaders: [...options.fanHeaders] } : {}),
      ...(options.rgbHeaders ? { rgbHeaders: [...options.rgbHeaders] } : {}),
      ...(options.supportedDataRatesMtps
        ? { supportedDataRatesMtps: [...options.supportedDataRatesMtps] }
        : {}),
    },
  };
}

function fan(
  index: number,
  options: { maxCurrentA?: number; rgbConnector?: 'ARGB_5V_3_PIN' | 'RGB_12V_4_PIN' } = {},
): CanonicalPart {
  const digit = String(index);
  return {
    schemaVersion: '1.1.0',
    partId: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`,
    category: 'CASE_FAN',
    manufacturer: 'Example',
    model: `Fan ${index}`,
    status: 'ACTIVE',
    spec: {
      diameterMm: 120,
      thicknessMm: 25,
      connector: 'PWM_4_PIN',
      ...options,
    },
  };
}

describe('fanHeaderCountRule', () => {
  test('requires a powered hub when fan count exceeds headers', async () => {
    const result = await exportedRule('fanHeaderCountRule').evaluate(
      context(
        [
          fan(5),
          fan(6),
          board({
            fanHeaders: [
              { type: 'SYSTEM_FAN', connector: 'PWM_4_PIN', count: 1 },
            ],
          }),
        ],
        'fan-headers',
      ),
    );

    expect(result).toMatchObject({
      status: 'CONDITIONAL',
      conditions: [{ code: 'USE_POWERED_FAN_HUB' }],
    });
  });
});

describe('fanHeaderCurrentRule', () => {
  test('requires a powered hub when total fan current exceeds headers', async () => {
    const result = await exportedRule('fanHeaderCurrentRule').evaluate(
      context(
        [
          fan(5, { maxCurrentA: 0.7 }),
          fan(6, { maxCurrentA: 0.7 }),
          board({
            fanHeaders: [
              {
                type: 'SYSTEM_FAN',
                connector: 'PWM_4_PIN',
                count: 1,
                maxCurrentA: 1,
              },
            ],
          }),
        ],
        'fan-current',
      ),
    );

    expect(result.status).toBe('CONDITIONAL');
  });

  test('returns unknown when current ratings are missing', async () => {
    const result = await exportedRule('fanHeaderCurrentRule').evaluate(
      context(
        [
          fan(5),
          board({
            fanHeaders: [
              { type: 'SYSTEM_FAN', connector: 'PWM_4_PIN', count: 1 },
            ],
          }),
        ],
        'fan-current',
      ),
    );

    expect(result.status).toBe('UNKNOWN');
  });

  test('does not combine separate header capacities for one over-current fan', async () => {
    const result = await exportedRule('fanHeaderCurrentRule').evaluate(
      context(
        [
          fan(5, { maxCurrentA: 1.4 }),
          board({
            fanHeaders: [
              {
                type: 'SYSTEM_FAN',
                connector: 'PWM_4_PIN',
                count: 2,
                maxCurrentA: 1,
              },
            ],
          }),
        ],
        'fan-current',
      ),
    );

    expect(result).toMatchObject({
      status: 'CONDITIONAL',
      conditions: [{ code: 'USE_POWERED_FAN_HUB' }],
    });
  });
});

describe('rgbHeaderRule', () => {
  test('rejects a 5V ARGB fan on a 12V-only RGB board', async () => {
    const result = await exportedRule('rgbHeaderRule').evaluate(
      context(
        [
          fan(5, { rgbConnector: 'ARGB_5V_3_PIN' }),
          board({ rgbHeaders: [{ type: 'RGB_12V_4_PIN', count: 2 }] }),
        ],
        'rgb',
      ),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('passes matching ARGB voltage and pin layout', async () => {
    const result = await exportedRule('rgbHeaderRule').evaluate(
      context(
        [
          fan(5, { rgbConnector: 'ARGB_5V_3_PIN' }),
          board({ rgbHeaders: [{ type: 'ARGB_5V_3_PIN', count: 1 }] }),
        ],
        'rgb',
      ),
    );

    expect(result.status).toBe('PASS');
  });

  test('advisory RGB incompatibility never produces BLOCK', () => {
    const aggregate = aggregateRuleResults([
      {
        ruleId: 'rgb-header',
        capabilityId: 'rgb',
        policyMode: 'ADVISORY',
        status: 'INCOMPATIBLE',
        summary: 'voltage mismatch',
        reasons: [],
        evidenceIds: [],
      },
      {
        ruleId: 'cpu-socket',
        capabilityId: 'socket',
        policyMode: 'REQUIRED',
        status: 'PASS',
        summary: 'socket matches',
        reasons: [],
        evidenceIds: [],
      },
    ]);

    expect(aggregate.decision).toBe('ALLOW_WITH_WARNING');
  });
});

describe('memoryDataRateAdvisoryRule', () => {
  test('warns when requested data rate is not listed by the board', async () => {
    const result = await exportedRule('memoryDataRateAdvisoryRule').evaluate(
      context([memory(), board({ supportedDataRatesMtps: [4800, 5600] })], 'memory-rate'),
    );

    expect(result.status).toBe('WARNING');
  });

  test('returns unknown when board data rates are missing', async () => {
    const result = await exportedRule('memoryDataRateAdvisoryRule').evaluate(
      context([memory(), board({})], 'memory-rate'),
    );

    expect(result.status).toBe('UNKNOWN');
  });
});

describe('fourDimmDataRateRule', () => {
  test('warns above the profile supplied four-DIMM stable data rate', async () => {
    const result = await exportedRule('fourDimmDataRateRule').evaluate(
      context(
        [memory('DDR5', 4), board({ supportedDataRatesMtps: [4800, 5600, 6000] })],
        'four-dimm-rate',
        { stableFourDimmDataRateMtps: 5600 },
      ),
    );

    expect(result.status).toBe('WARNING');
  });

  test('returns unknown when the profile has no four-DIMM threshold', async () => {
    const result = await exportedRule('fourDimmDataRateRule').evaluate(
      context(
        [memory('DDR5', 4), board({ supportedDataRatesMtps: [4800, 5600, 6000] })],
        'four-dimm-rate',
      ),
    );

    expect(result.status).toBe('UNKNOWN');
  });
});
