import type {
  CanonicalPart,
  EngineRule,
  InstallationContext,
} from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as rules from '../src/index.js';
import {
  context,
  cpu,
  cpuCooler,
  gpu,
  installationContext,
  psu,
} from './fixtures.js';

function exportedRule(name: string): EngineRule {
  const candidate = (rules as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as EngineRule;
}

function clearanceCase(
  overrides: Partial<{
    maxGpuLengthMm: number;
    maxCpuCoolerHeightMm: number;
    maxPsuLengthMm: number;
    radiatorMounts: Array<{
      position: 'FRONT' | 'TOP' | 'REAR' | 'BOTTOM' | 'SIDE';
      supportedSizesMm: number[];
      maxCombinedThicknessMm?: number;
    }>;
  }> = {},
): CanonicalPart {
  return {
    schemaVersion: '3.0.0',
    partId: '44444444-4444-4444-8444-444444444444',
    category: 'PC_CASE',
    manufacturer: 'Example',
    model: 'Case',
    status: 'ACTIVE',
    spec: {
      supportedMotherboardFormFactors: ['ATX'],
      ...overrides,
    },
  };
}

function withRadiator(
  radiator: NonNullable<InstallationContext['radiators']>[number],
): InstallationContext {
  return { ...installationContext, radiators: [radiator] };
}

describe('gpuClearanceRule', () => {
  test('returns unknown when installed radiator facts are not known', async () => {
    const unknownContext: InstallationContext = { schemaVersion: '2.0.0' };
    const result = await exportedRule('gpuClearanceRule').evaluate(
      context(
        [gpu(300), clearanceCase({ maxGpuLengthMm: 320 })],
        'gpu-clearance',
        undefined,
        unknownContext as unknown as InstallationContext,
      ),
    );

    expect(result.status).toBe('UNKNOWN');
  });

  test('returns unknown when a front radiator stack thickness is incomplete', async () => {
    const result = await exportedRule('gpuClearanceRule').evaluate(
      context(
        [gpu(300), clearanceCase({ maxGpuLengthMm: 350 })],
        'gpu-clearance',
        undefined,
        withRadiator({
          position: 'FRONT',
          sizeMm: 360,
          radiatorThicknessMm: 30,
        } as NonNullable<InstallationContext['radiators']>[number]),
      ),
    );

    expect(result.status).toBe('UNKNOWN');
  });

  test('returns incompatible when GPU is longer than effective clearance', async () => {
    const result = await exportedRule('gpuClearanceRule').evaluate(
      context([gpu(321), clearanceCase({ maxGpuLengthMm: 320 })], 'gpu-clearance'),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('returns conditional at equality with the default 10 mm margin', async () => {
    const result = await exportedRule('gpuClearanceRule').evaluate(
      context([gpu(320), clearanceCase({ maxGpuLengthMm: 320 })], 'gpu-clearance'),
    );

    expect(result).toMatchObject({
      status: 'CONDITIONAL',
      conditions: [{ code: 'VERIFY_PHYSICAL_CLEARANCE' }],
    });
  });

  test('passes equality when safety margin is configured to zero', async () => {
    const result = await exportedRule('gpuClearanceRule').evaluate(
      context(
        [gpu(320), clearanceCase({ maxGpuLengthMm: 320 })],
        'gpu-clearance',
        { safetyMarginMm: 0 },
      ),
    );

    expect(result.status).toBe('PASS');
  });

  test('subtracts a front radiator stack from GPU clearance', async () => {
    const result = await exportedRule('gpuClearanceRule').evaluate(
      context(
        [gpu(330), clearanceCase({ maxGpuLengthMm: 350 })],
        'gpu-clearance',
        undefined,
        withRadiator({
          position: 'FRONT',
          sizeMm: 360,
          radiatorThicknessMm: 30,
          fanThicknessMm: 25,
        }),
      ),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('returns unknown when a required measurement is missing', async () => {
    const result = await exportedRule('gpuClearanceRule').evaluate(
      context([gpu(), clearanceCase({ maxGpuLengthMm: 320 })], 'gpu-clearance'),
    );

    expect(result.status).toBe('UNKNOWN');
  });

  test('rejects a negative safety margin', () => {
    expect(() =>
      exportedRule('gpuClearanceRule').evaluate(
        context(
          [gpu(300), clearanceCase({ maxGpuLengthMm: 320 })],
          'gpu-clearance',
          { safetyMarginMm: -1 },
        ),
      ),
    ).toThrow('safetyMarginMm must be a non-negative number');
  });
});

describe('cpuCoolerHeightRule', () => {
  test('uses the 5 mm default margin at equality', async () => {
    const result = await exportedRule('cpuCoolerHeightRule').evaluate(
      context(
        [cpuCooler({ heightMm: 165 }), clearanceCase({ maxCpuCoolerHeightMm: 165 })],
        'cooler-clearance',
      ),
    );

    expect(result.status).toBe('CONDITIONAL');
  });
});

describe('psuLengthRule', () => {
  test('uses the 10 mm default margin at equality', async () => {
    const result = await exportedRule('psuLengthRule').evaluate(
      context([psu(160), clearanceCase({ maxPsuLengthMm: 160 })], 'psu-clearance'),
    );

    expect(result.status).toBe('CONDITIONAL');
  });
});

describe('radiatorMountRule', () => {
  test('returns unknown when installed radiator thickness is not known', async () => {
    const result = await exportedRule('radiatorMountRule').evaluate(
      context(
        [clearanceCase({
          radiatorMounts: [{
            position: 'FRONT',
            supportedSizesMm: [360],
            maxCombinedThicknessMm: 70,
          }],
        })],
        'radiator',
        undefined,
        withRadiator({
          position: 'FRONT',
          sizeMm: 360,
        } as NonNullable<InstallationContext['radiators']>[number]),
      ),
    );

    expect(result.status).toBe('UNKNOWN');
  });

  test('rejects a radiator size unsupported at its position', async () => {
    const result = await exportedRule('radiatorMountRule').evaluate(
      context(
        [
          clearanceCase({
            radiatorMounts: [
              { position: 'FRONT', supportedSizesMm: [240, 280, 360] },
            ],
          }),
        ],
        'radiator',
        undefined,
        withRadiator({
          position: 'FRONT',
          sizeMm: 200,
          radiatorThicknessMm: 30,
          fanThicknessMm: 25,
        }),
      ),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('returns conditional when stack equals mount thickness', async () => {
    const result = await exportedRule('radiatorMountRule').evaluate(
      context(
        [
          clearanceCase({
            radiatorMounts: [
              {
                position: 'SIDE',
                supportedSizesMm: [200],
                maxCombinedThicknessMm: 55,
              },
            ],
          }),
        ],
        'radiator',
        undefined,
        withRadiator({
          position: 'SIDE',
          sizeMm: 200,
          radiatorThicknessMm: 30,
          fanThicknessMm: 25,
        }),
      ),
    );

    expect(result.status).toBe('CONDITIONAL');
  });

  test('accepts a nonstandard size when mount support and margin are sufficient', async () => {
    const result = await exportedRule('radiatorMountRule').evaluate(
      context(
        [
          clearanceCase({
            radiatorMounts: [
              {
                position: 'SIDE',
                supportedSizesMm: [200],
                maxCombinedThicknessMm: 70,
              },
            ],
          }),
        ],
        'radiator',
        undefined,
        withRadiator({
          position: 'SIDE',
          sizeMm: 200,
          radiatorThicknessMm: 30,
          fanThicknessMm: 25,
        }),
      ),
    );

    expect(result.status).toBe('PASS');
  });
});

describe('cpuCoolerSocketRule', () => {
  test('rejects a cooler without CPU socket support', async () => {
    const result = await exportedRule('cpuCoolerSocketRule').evaluate(
      context(
        [cpu('AM5'), cpuCooler({ supportedSockets: ['LGA1851'] })],
        'cooler-socket',
      ),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });
});
