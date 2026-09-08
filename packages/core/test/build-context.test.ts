import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { expect, test } from 'vitest';

import * as core from '../src/index.js';

function exportedSchema(name: string): TSchema {
  const candidate = (core as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as TSchema;
}

test('installed radiator size is any positive integer', () => {
  const schema = exportedSchema('InstalledRadiatorSchema');
  const radiator = {
    position: 'SIDE',
    sizeMm: 200,
    radiatorThicknessMm: 30,
    fanThicknessMm: 25,
  };

  expect(Value.Check(schema, radiator)).toBe(true);
  expect(Value.Check(schema, { ...radiator, sizeMm: 0 })).toBe(false);
  expect(Value.Check(schema, { ...radiator, sizeMm: 200.5 })).toBe(false);
});

test('installation context distinguishes unknown facts from confirmed zero values', () => {
  const schema = exportedSchema('InstallationContextSchema');

  expect(Value.Check(schema, { schemaVersion: '2.0.0' })).toBe(true);
  expect(
    Value.Check(schema, {
      schemaVersion: '2.0.0',
      radiators: [],
      pciePower: {
        independentCableCount: 0,
        native12VhpwrCableCount: 0,
        native12V2x6CableCount: 0,
        adapterUsed: false,
      },
    }),
  ).toBe(true);
});

test('installation context validates exact field evidence inputs', () => {
  const schema = exportedSchema('InstallationContextSchema');

  expect(
    Value.Check(schema, {
      schemaVersion: '2.0.0',
      radiators: [
        {
          position: 'FRONT',
          sizeMm: 360,
          radiatorThicknessMm: 38,
          fanThicknessMm: 25,
        },
      ],
      hddCages: [
        { cageId: 'LOWER_1', position: 'PSU_SHROUD', installed: true },
      ],
      gpuOrientation: 'HORIZONTAL',
      occupiedPcieSlotIds: ['PCIE_1'],
      pciePower: {
        independentCableCount: 2,
        native12VhpwrCableCount: 0,
        native12V2x6CableCount: 1,
        adapterUsed: false,
      },
      installedBiosVersion: '1.2.0',
      customFacts: { benchAssembly: false },
    }),
  ).toBe(true);
  expect(
    Value.Check(schema, {
      schemaVersion: '2.0.0',
      radiators: [],
      hddCages: [],
      gpuOrientation: 'DIAGONAL',
      occupiedPcieSlotIds: [],
      pciePower: {
        independentCableCount: 0,
        native12VhpwrCableCount: 0,
        native12V2x6CableCount: 0,
        adapterUsed: false,
      },
    }),
  ).toBe(false);
});

test('upgrade intent preserves existing and requested change concepts', () => {
  const schema = exportedSchema('BuildIntentSchema');

  expect(
    Value.Check(schema, {
      schemaVersion: '1.0.0',
      useCase: 'UPGRADE',
      existingParts: [
        { partId: '11111111-1111-4111-8111-111111111111', quantity: 1 },
      ],
      preservedParts: [
        { partId: '22222222-2222-4222-8222-222222222222', quantity: 1 },
      ],
      requestedChanges: [
        {
          category: 'GPU',
          replacedPartId: '11111111-1111-4111-8111-111111111111',
          candidatePartId: '33333333-3333-4333-8333-333333333333',
        },
      ],
    }),
  ).toBe(true);
});
