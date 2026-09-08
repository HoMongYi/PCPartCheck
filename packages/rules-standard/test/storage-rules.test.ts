import type { CanonicalPart, EngineRule, M2SlotSpec, PcieSlotSpec } from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as rules from '../src/index.js';
import { context, gpu } from './fixtures.js';

function exportedRule(name: string): EngineRule {
  const candidate = (rules as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as EngineRule;
}

function board(
  m2Slots?: readonly M2SlotSpec[],
  pcieSlots?: readonly PcieSlotSpec[],
): CanonicalPart {
  return {
    schemaVersion: '2.0.0',
    partId: '22222222-2222-4222-8222-222222222222',
    category: 'MOTHERBOARD',
    manufacturer: 'Example',
    model: 'Board',
    status: 'ACTIVE',
    spec: {
      socket: 'AM5',
      formFactor: 'ATX',
      memoryTechnologies: ['DDR5'],
      ...(m2Slots ? { m2Slots: [...m2Slots] } : {}),
      ...(pcieSlots ? { pcieSlots: [...pcieSlots] } : {}),
    },
  };
}

function storage(
  index: number,
  interfaceType: 'PCIE_NVME' | 'SATA' = 'PCIE_NVME',
  formFactor: 2230 | 2242 | 2260 | 2280 | 22110 = 2280,
): CanonicalPart {
  const digit = String(index).repeat(8);
  return {
    schemaVersion: '2.0.0',
    partId: `${digit}-${String(index).repeat(4)}-4${String(index).repeat(3)}-8${String(index).repeat(3)}-${String(index).repeat(12)}`,
    category: 'STORAGE',
    manufacturer: 'Example',
    model: `Storage ${index}`,
    status: 'ACTIVE',
    spec: {
      storageType: interfaceType === 'PCIE_NVME' ? 'NVME_SSD' : 'SATA_SSD',
      capacityGb: 1000,
      interface: interfaceType,
      m2FormFactor: formFactor,
    },
  };
}

const flexibleSlot: M2SlotSpec = {
  slotId: 'M2_1',
  key: 'M',
  formFactors: [2260, 2280],
  interfaces: ['PCIE_NVME', 'SATA'],
};
const nvmeOnlySlot: M2SlotSpec = {
  slotId: 'M2_2',
  key: 'M',
  formFactors: [2280],
  interfaces: ['PCIE_NVME'],
};

describe('m2SlotCompatibilityRule', () => {
  test('rejects more M.2 devices than compatible slots', async () => {
    const result = await exportedRule('m2SlotCompatibilityRule').evaluate(
      context([storage(1), storage(2), board([nvmeOnlySlot])], 'storage'),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('rejects an interface unsupported by available M.2 slots', async () => {
    const result = await exportedRule('m2SlotCompatibilityRule').evaluate(
      context([storage(1, 'SATA'), board([nvmeOnlySlot])], 'storage'),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('returns unknown when motherboard slot data is missing', async () => {
    const result = await exportedRule('m2SlotCompatibilityRule').evaluate(
      context([storage(1), board()], 'storage'),
    );

    expect(result.status).toBe('UNKNOWN');
  });

  test('finds a valid assignment for constrained and flexible devices', async () => {
    const result = await exportedRule('m2SlotCompatibilityRule').evaluate(
      context(
        [storage(1, 'SATA', 2260), storage(2), board([flexibleSlot, nvmeOnlySlot])],
        'storage',
      ),
    );

    expect(result.status).toBe('PASS');
  });
});

describe('m2SataSharingRule', () => {
  test('returns conditional when an M.2 slot may disable SATA ports', async () => {
    const sharedSlot: M2SlotSpec = {
      ...nvmeOnlySlot,
      sharedSataPortIds: ['SATA_1', 'SATA_2'],
    };
    const result = await exportedRule('m2SataSharingRule').evaluate(
      context([storage(1), storage(2, 'SATA'), board([sharedSlot])], 'storage-sharing'),
    );

    expect(result).toMatchObject({
      status: 'CONDITIONAL',
      conditions: [{ code: 'VERIFY_SATA_PORT_SHARING' }],
    });
  });
});

describe('pcieSlotCompatibilityRule', () => {
  test('rejects a GPU only when no physical slot is large enough', async () => {
    const graphics = {
      ...gpu(300),
      schemaVersion: '2.0.0',
      spec: {
        lengthMm: 300,
        pcieGeneration: 5,
        physicalConnectorLanes: 16,
        maxLinkWidthLanes: 16,
      },
    } as CanonicalPart;
    const result = await exportedRule('pcieSlotCompatibilityRule').evaluate(
      context(
        [
          graphics,
          board(undefined, [
            {
              slotId: 'PCIE_1',
              generation: 5,
              physicalLanes: 4,
              electricalLanes: 4,
              positionIndex: 1,
            },
          ]),
        ],
        'pcie-slot',
      ),
    );

    expect(result.status).toBe('INCOMPATIBLE');
  });

  test('allows a physical x16 GPU in a physical x16 electrical x8 slot', async () => {
    const graphics = {
      ...gpu(300),
      schemaVersion: '2.0.0',
      spec: {
        lengthMm: 300,
        pcieGeneration: 5,
        physicalConnectorLanes: 16,
        maxLinkWidthLanes: 16,
      },
    } as CanonicalPart;
    const result = await exportedRule('pcieSlotCompatibilityRule').evaluate(
      context(
        [
          graphics,
          board(undefined, [
            {
              slotId: 'PCIE_1',
              generation: 5,
              physicalLanes: 16,
              electricalLanes: 8,
              positionIndex: 1,
            },
          ]),
        ],
        'pcie-slot',
      ),
    );

    expect(result.status).toBe('PASS');
  });

  test('assigns GPU and add-in cards to separate physical slots', async () => {
    const graphics = {
      ...gpu(300),
      schemaVersion: '2.0.0',
      spec: { lengthMm: 300, physicalConnectorLanes: 16 },
    } as CanonicalPart;
    const captureCard = {
      schemaVersion: '2.0.0',
      partId: '99999999-9999-4999-8999-999999999999',
      category: 'PCIE_CARD',
      manufacturer: 'Example',
      model: 'Capture Card',
      status: 'ACTIVE',
      spec: { cardType: 'CAPTURE_CARD', physicalConnectorLanes: 4 },
    } as CanonicalPart;
    const result = await exportedRule('pcieSlotCompatibilityRule').evaluate(
      context(
        [
          graphics,
          captureCard,
          board(undefined, [
            {
              slotId: 'PCIE_1',
              generation: 5,
              physicalLanes: 16,
              electricalLanes: 8,
              positionIndex: 1,
            },
            {
              slotId: 'PCIE_2',
              generation: 4,
              physicalLanes: 4,
              electricalLanes: 4,
              positionIndex: 2,
            },
          ]),
        ],
        'pcie-slot',
      ),
    );

    expect(result.status).toBe('PASS');
  });

  test('returns unknown when GPU PCIe requirements are missing', async () => {
    const result = await exportedRule('pcieSlotCompatibilityRule').evaluate(
      context(
        [
          gpu(300),
          board(undefined, [
            {
              slotId: 'PCIE_1',
              generation: 5,
              physicalLanes: 16,
              electricalLanes: 16,
              positionIndex: 1,
            },
          ]),
        ],
        'pcie-slot',
      ),
    );

    expect(result.status).toBe('UNKNOWN');
  });
});

describe('pcieBandwidthAdvisoryRule', () => {
  const graphics = {
    ...gpu(300),
    schemaVersion: '2.0.0',
    spec: {
      lengthMm: 300,
      pcieGeneration: 5,
      physicalConnectorLanes: 16,
      maxLinkWidthLanes: 16,
    },
  } as CanonicalPart;

  test('warns about electrical x8 without calling the GPU incompatible', async () => {
    const result = await exportedRule('pcieBandwidthAdvisoryRule').evaluate(
      context(
        [
          graphics,
          board(undefined, [
            {
              slotId: 'PCIE_1',
              generation: 5,
              physicalLanes: 16,
              electricalLanes: 8,
              positionIndex: 1,
            },
          ]),
        ],
        'pcie-bandwidth',
      ),
    );

    expect(result.status).toBe('WARNING');
  });

  test('warns when the available slot generation is lower', async () => {
    const result = await exportedRule('pcieBandwidthAdvisoryRule').evaluate(
      context(
        [
          graphics,
          board(undefined, [
            {
              slotId: 'PCIE_1',
              generation: 4,
              physicalLanes: 16,
              electricalLanes: 16,
              positionIndex: 1,
            },
          ]),
        ],
        'pcie-bandwidth',
      ),
    );

    expect(result.status).toBe('WARNING');
  });
});
