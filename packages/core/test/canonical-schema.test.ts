import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { expect, expectTypeOf, test } from 'vitest';

import * as core from '../src/index.js';
import type { PartCategory } from '../src/index.js';

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
      physicalLanes: 16,
      electricalLanes: 8,
      positionIndex: 1,
    }),
  ).toBe(true);
  expect(
    Value.Check(pcie, {
      slotId: 'PCIE_1',
      generation: 'Gen5',
      physicalLanes: 16,
      electricalLanes: 8,
      positionIndex: 1,
    }),
  ).toBe(false);
  expect(
    Value.Check(pcie, {
      slotId: 'PCIE_1',
      generation: 5,
      lanes: 16,
      positionIndex: 1,
    }),
  ).toBe(false);
});

test('canonical 3.0 represents M.2 device keys and partial fan or PSU data', () => {
  const canonical = exportedSchema('CanonicalPartSchema');

  expect(Value.Check(canonical, {
    schemaVersion: '3.0.0',
    partId: '77777777-7777-4777-8777-777777777777',
    category: 'STORAGE',
    manufacturer: 'Example',
    model: 'M-key SSD',
    status: 'ACTIVE',
    spec: {
      storageType: 'NVME_SSD',
      capacityGb: 1000,
      interface: 'PCIE_NVME',
      m2FormFactor: 2280,
      m2Key: 'M',
    },
  })).toBe(true);
  expect(Value.Check(canonical, {
    schemaVersion: '3.0.0',
    partId: '88888888-8888-4888-8888-888888888888',
    category: 'CASE_FAN',
    manufacturer: 'Example',
    model: 'Partial Fan',
    status: 'ACTIVE',
    spec: { diameterMm: 120, connector: 'PWM_4_PIN' },
  })).toBe(true);
  expect(Value.Check(canonical, {
    schemaVersion: '3.0.0',
    partId: '99999999-9999-4999-8999-999999999999',
    category: 'PSU',
    manufacturer: 'Example',
    model: 'Unknown Inventory PSU',
    status: 'ACTIVE',
    spec: { formFactor: 'ATX', ratedPowerW: 850 },
  })).toBe(true);
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

test('new canonical parts use schema version 3.0.0 and structured spec', () => {
  const schema = exportedSchema('CanonicalPartSchema');
  const cpu = {
    schemaVersion: '3.0.0',
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
  expect(Value.Check(schema, { ...cpu, partId: 'cpu-1' })).toBe(false);
  expect(Value.Check(schema, { ...cpu, schemaVersion: '1.0.0' })).toBe(
    false,
  );
  expect(Value.Check(schema, { ...cpu, schemaVersion: '1.1.0' })).toBe(
    false,
  );
});

test('part category remains a closed public literal union', () => {
  expectTypeOf<PartCategory>().toEqualTypeOf<
    | 'CPU'
    | 'CPU_COOLER'
    | 'GPU'
    | 'MOTHERBOARD'
    | 'PC_CASE'
    | 'PSU'
    | 'MEMORY'
    | 'STORAGE'
    | 'CASE_FAN'
    | 'PCIE_CARD'
  >();
});

test('consumer connector requirements distinguish required optional and conditional modes', () => {
  const schema = exportedSchema('PowerConnectorRequirementSchema');

  expect(
    Value.Check(schema, {
      type: 'EPS_8_PIN',
      count: 1,
      mode: 'OPTIONAL',
    }),
  ).toBe(true);
  expect(
    Value.Check(schema, {
      type: 'PCIE_8_PIN',
      count: 2,
      mode: 'CONDITIONAL',
      condition: { code: 'HIGH_POWER_CPU', message: '고전력 설정에서 필요합니다.' },
    }),
  ).toBe(true);
  expect(
    Value.Check(schema, { type: 'EPS_8_PIN', count: 1 }),
  ).toBe(false);
});

test('PCIe add-in cards have physical and maximum link widths', () => {
  const schema = exportedSchema('CanonicalPartSchema');

  expect(
    Value.Check(schema, {
      schemaVersion: '3.0.0',
      partId: '99999999-9999-4999-8999-999999999999',
      category: 'PCIE_CARD',
      manufacturer: 'Example',
      model: 'Capture Card',
      status: 'ACTIVE',
      spec: {
        cardType: 'CAPTURE_CARD',
        physicalConnectorLanes: 4,
        maxLinkWidthLanes: 4,
        pcieGeneration: 3,
      },
    }),
  ).toBe(true);
});

test('PSU spec can carry normalized physical length for case clearance', () => {
  const schema = exportedSchema('CanonicalPartSchema');
  const psu = {
    schemaVersion: '3.0.0',
    partId: '55555555-5555-4555-8555-555555555555',
    category: 'PSU',
    manufacturer: 'Example',
    model: 'PSU',
    status: 'ACTIVE',
    spec: {
      formFactor: 'ATX',
      ratedPowerW: 850,
      powerConnectors: [],
    },
  };

  expect(Value.Check(schema, psu)).toBe(true);
  expect(
    Value.Check(schema, { ...psu, spec: { ...psu.spec, lengthMm: 160 } }),
  ).toBe(true);
  expect(
    Value.Check(schema, { ...psu, spec: { ...psu.spec, lengthMm: 0 } }),
  ).toBe(false);
  expect(
    Value.Check(schema, { ...psu, spec: { ...psu.spec, lengthMm: -1 } }),
  ).toBe(false);
  expect(
    Value.Check(schema, { ...psu, spec: { ...psu.spec, lengthMm: '160' } }),
  ).toBe(false);
});
