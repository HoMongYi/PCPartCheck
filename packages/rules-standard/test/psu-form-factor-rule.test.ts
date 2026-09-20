import type {
  CanonicalPart,
  EngineRule,
  PsuFormFactor,
} from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as rules from '../src/index.js';
import { context } from './fixtures.js';

function exportedRule(): EngineRule {
  const candidate = (rules as Readonly<Record<string, unknown>>)
    .psuFormFactorRule;
  expect(candidate, 'psuFormFactorRule must be exported').toBeDefined();
  return candidate as EngineRule;
}

function casePart(
  supportedPsuFormFactors: readonly PsuFormFactor[] | undefined,
): CanonicalPart {
  return {
    schemaVersion: '3.1.0',
    partId: '44444444-4444-4444-8444-444444444444',
    category: 'PC_CASE',
    manufacturer: 'Example',
    model: 'Case',
    status: 'ACTIVE',
    spec: {
      supportedMotherboardFormFactors: ['ATX'],
      ...(supportedPsuFormFactors === undefined
        ? {}
        : { supportedPsuFormFactors: [...supportedPsuFormFactors] }),
    },
  };
}

function psuPart(formFactor: PsuFormFactor | undefined): CanonicalPart {
  return {
    schemaVersion: '3.1.0',
    partId: '77777777-7777-4777-8777-777777777777',
    category: 'PSU',
    manufacturer: 'Example',
    model: 'PSU',
    status: 'ACTIVE',
    spec: {
      ...(formFactor === undefined ? {} : { formFactor }),
      ratedPowerW: 850,
      powerConnectors: [],
    },
  };
}

describe('psuFormFactorRule', () => {
  test.each([
    ['explicit supported form factor', ['ATX'], 'ATX', 'PASS'],
    ['explicit unsupported form factor', ['SFX'], 'ATX', 'INCOMPATIBLE'],
    ['missing case spec', undefined, 'ATX', 'UNKNOWN'],
    ['missing PSU form factor', ['ATX'], undefined, 'UNKNOWN'],
  ] as const)('%s', async (_name, supported, formFactor, status) => {
    const result = await exportedRule().evaluate(
      context(
        [casePart(supported), psuPart(formFactor)],
        'psu-form-factor',
      ),
    );

    expect(result).toMatchObject({ status });
  });
});
