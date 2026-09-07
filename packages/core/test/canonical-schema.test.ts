import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { expect, test } from 'vitest';

import * as core from '../src/index.js';

function exportedSchema(name: string): TSchema {
  const candidate = (core as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as TSchema;
}

test('power connectors use canonical connector identifiers', () => {
  const schema = exportedSchema('PowerConnectorSpecSchema');

  expect(
    Value.Check(schema, { type: 'PCIE_12V_2X6', count: 1 }),
  ).toBe(true);
  expect(Value.Check(schema, { type: '12V2X6', count: 1 })).toBe(false);
});

test('fan, RGB, and USB headers reject arbitrary strings', () => {
  const fan = exportedSchema('FanHeaderSpecSchema');
  const rgb = exportedSchema('RgbHeaderSpecSchema');
  const usb = exportedSchema('UsbHeaderSpecSchema');

  expect(
    Value.Check(fan, {
      type: 'SYSTEM_FAN',
      connector: 'PWM_4_PIN',
      count: 3,
      maxCurrentA: 1,
    }),
  ).toBe(true);
  expect(
    Value.Check(rgb, { type: 'ARGB_5V_3_PIN', count: 2 }),
  ).toBe(true);
  expect(
    Value.Check(usb, { type: 'USB_3_2_GEN2_TYPE_E', count: 1 }),
  ).toBe(true);
  expect(Value.Check(rgb, { type: 'ARGB', count: 1 })).toBe(false);
});

test('M.2 and PCIe slots expose structured capabilities', () => {
  const m2 = exportedSchema('M2SlotSpecSchema');
  const pcie = exportedSchema('PcieSlotSpecSchema');

  expect(
    Value.Check(m2, {
      slotId: 'M2_1',
      key: 'M',
      formFactors: [2280],
      interfaces: ['PCIE_NVME', 'SATA'],
      pcieGen: 5,
      lanes: 4,
      sharedSataPortIds: ['SATA_1'],
    }),
  ).toBe(true);
  expect(
    Value.Check(pcie, {
      slotId: 'PCIE_1',
      generation: 5,
      lanes: 16,
      positionIndex: 1,
    }),
  ).toBe(true);
  expect(
    Value.Check(pcie, {
      slotId: 'PCIE_1',
      generation: 'Gen5',
      lanes: 16,
      positionIndex: 1,
    }),
  ).toBe(false);
});

test('radiator mounts accept new positive integer sizes without a schema release', () => {
  const schema = exportedSchema('RadiatorMountSpecSchema');

  expect(
    Value.Check(schema, {
      position: 'FRONT',
      supportedSizesMm: [200, 360],
      maxCombinedThicknessMm: 70,
    }),
  ).toBe(true);
  expect(
    Value.Check(schema, {
      position: 'FRONT',
      supportedSizesMm: [0],
    }),
  ).toBe(false);
});

test('memory uses MT/s data rate and reserves MHz for actual clock', () => {
  const schema = exportedSchema('MemorySpecSchema');

  expect(
    Value.Check(schema, {
      technology: 'DDR5',
      formFactor: 'DIMM',
      moduleCount: 2,
      capacityPerModuleGb: 16,
      dataRateMtps: 6000,
      clockMHz: 3000,
    }),
  ).toBe(true);
  expect(
    Value.Check(schema, {
      technology: 'DDR5',
      formFactor: 'DIMM',
      moduleCount: 2,
      capacityPerModuleGb: 16,
      speedMHz: 6000,
    }),
  ).toBe(false);
});

test('canonical parts carry the exact schema version and structured spec', () => {
  const schema = exportedSchema('CanonicalPartSchema');
  const cpu = {
    schemaVersion: '1.0.0',
    partId: 'a0dca831-d8d7-4f2c-9e81-d94d260dd5d7',
    category: 'CPU',
    manufacturer: 'Example',
    model: 'Eight Core',
    status: 'ACTIVE',
    spec: {
      socket: 'AM5',
      coreCount: 8,
      threadCount: 16,
      peakPowerW: 120,
    },
  };

  expect(Value.Check(schema, cpu)).toBe(true);
  expect(Value.Check(schema, { ...cpu, schemaVersion: '2.0.0' })).toBe(
    false,
  );
});
