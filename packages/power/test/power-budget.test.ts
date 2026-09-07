import type {
  CanonicalBuild,
  CanonicalPart,
  CompatibilityRuleContext,
  EngineRule,
  InstallationContext,
  PowerConnectorSpec,
} from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as power from '../src/index.js';

function exportedFunction(name: string) {
  const candidate = (power as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeTypeOf('function');
  return candidate as (build: CanonicalBuild) => Readonly<Record<string, unknown>>;
}

function exportedRule(name: string): EngineRule {
  const candidate = (power as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as EngineRule;
}

function part(
  category: CanonicalPart['category'],
  spec: Readonly<Record<string, unknown>>,
  idDigit: number,
): CanonicalPart {
  const digit = String(idDigit);
  return {
    schemaVersion: '1.0.0',
    partId: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`,
    category,
    manufacturer: 'Example',
    model: category,
    status: 'ACTIVE',
    spec,
  } as CanonicalPart;
}

function baseParts(vendorRecommendedPsuW = 650): CanonicalPart[] {
  return [
    part('CPU', { socket: 'AM5', peakPowerW: 120 }, 1),
    part('GPU', { peakPowerW: 300, vendorRecommendedPsuW }, 2),
    part(
      'MOTHERBOARD',
      { socket: 'AM5', formFactor: 'ATX', memoryTechnologies: ['DDR5'] },
      3,
    ),
    part(
      'MEMORY',
      {
        technology: 'DDR5',
        formFactor: 'DIMM',
        moduleCount: 2,
        capacityPerModuleGb: 16,
      },
      4,
    ),
  ];
}

function build(parts: readonly CanonicalPart[]): CanonicalBuild {
  return { schemaVersion: '1.0.0', parts: [...parts] };
}

const installationContext: InstallationContext = {
  schemaVersion: '1.0.0',
  radiators: [],
  hddCages: [],
  gpuOrientation: 'HORIZONTAL',
  occupiedPcieSlotIds: [],
  pciePower: {
    independentCableCount: 2,
    native12VhpwrCableCount: 0,
    native12V2x6CableCount: 0,
    adapterUsed: false,
  },
};

function context(parts: readonly CanonicalPart[]): CompatibilityRuleContext {
  return {
    build: build(parts),
    intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
    installationContext,
    policy: { capabilityId: 'power', mode: 'REQUIRED' },
  };
}

describe('calculatePowerBudget', () => {
  test('applies the approved peak, reserve, headroom, and rounding formulas', () => {
    const result = exportedFunction('calculatePowerBudget')(build(baseParts()));

    expect(result).toMatchObject({
      status: 'CALCULATED',
      estimatedPeakPowerW: 500,
      minimumPsuW: 600,
      calculatedRecommendedPsuW: 650,
      recommendedPsuW: 650,
    });
  });

  test('selects a higher vendor recommendation', () => {
    const result = exportedFunction('calculatePowerBudget')(
      build(baseParts(750)),
    );

    expect(result).toMatchObject({ recommendedPsuW: 750, selectedBy: 'VENDOR' });
  });

  test('keeps the higher calculated recommendation', () => {
    const result = exportedFunction('calculatePowerBudget')(
      build(baseParts(600)),
    );

    expect(result).toMatchObject({
      calculatedRecommendedPsuW: 650,
      recommendedPsuW: 650,
      selectedBy: 'CALCULATED',
    });
  });

  test('returns unknown when CPU peak power is missing', () => {
    const parts = baseParts();
    parts[0] = part('CPU', { socket: 'AM5' }, 1);

    expect(exportedFunction('calculatePowerBudget')(build(parts))).toMatchObject({
      status: 'UNKNOWN',
      missingPartIds: [parts[0]!.partId],
    });
  });

  test('records policy-default evidence for motherboard and memory allowances', () => {
    const result = exportedFunction('calculatePowerBudget')(build(baseParts()));

    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: 'POLICY_DEFAULT',
          sourceId: 'power-estimation-v1',
          confidence: 'LOW',
          allowanceKind: 'MOTHERBOARD',
          valueW: 70,
        }),
        expect.objectContaining({
          allowanceKind: 'MEMORY_MODULE',
          valueW: 10,
        }),
      ]),
    );
  });
});

describe('psuCapacityRule', () => {
  test('rejects PSU capacity below the hard minimum', async () => {
    const result = await exportedRule('psuCapacityRule').evaluate(
      context([...baseParts(), part('PSU', { formFactor: 'ATX', ratedPowerW: 550, powerConnectors: [] }, 5)]),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('warns between minimum and recommendation', async () => {
    const result = await exportedRule('psuCapacityRule').evaluate(
      context([...baseParts(), part('PSU', { formFactor: 'ATX', ratedPowerW: 600, powerConnectors: [] }, 5)]),
    );

    expect(result.status).toBe('WARNING');
  });

  test('passes at the recommendation boundary', async () => {
    const result = await exportedRule('psuCapacityRule').evaluate(
      context([...baseParts(), part('PSU', { formFactor: 'ATX', ratedPowerW: 650, powerConnectors: [] }, 5)]),
    );

    expect(result.status).toBe('PASS');
  });
});

describe('psuConnectorRule', () => {
  function gpuWith(connectors: readonly PowerConnectorSpec[]): CanonicalPart {
    return part(
      'GPU',
      { peakPowerW: 300, vendorRecommendedPsuW: 650, powerConnectors: connectors },
      2,
    );
  }

  test('rejects missing GPU power connectors even when wattage is sufficient', async () => {
    const result = await exportedRule('psuConnectorRule').evaluate(
      context([
        gpuWith([{ type: 'PCIE_8_PIN', count: 2 }]),
        part('PSU', { formFactor: 'ATX', ratedPowerW: 850, powerConnectors: [{ type: 'PCIE_8_PIN', count: 1 }] }, 5),
      ]),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('returns conditional for a declared 12V-2x6 adapter path', async () => {
    const adaptedContext = {
      ...context([
        gpuWith([{ type: 'PCIE_12V_2X6', count: 1 }]),
        part('PSU', { formFactor: 'ATX', ratedPowerW: 850, powerConnectors: [{ type: 'PCIE_8_PIN', count: 2 }] }, 5),
      ]),
      installationContext: {
        ...installationContext,
        pciePower: { ...installationContext.pciePower, adapterUsed: true },
      },
    };

    const result = await exportedRule('psuConnectorRule').evaluate(adaptedContext);

    expect(result).toMatchObject({
      status: 'CONDITIONAL',
      conditions: [{ code: 'VERIFY_GPU_POWER_ADAPTER' }],
    });
  });
});
