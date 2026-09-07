import type {
  EngineRule,
  M2SlotSpec,
  StorageSpec,
} from '@pcpartcheck/core';

import { partsOf } from './parts.js';

function unknown(summary: string) {
  return {
    status: 'UNKNOWN' as const,
    summary,
    reasons: ['Required canonical platform resource data is missing'],
    evidenceIds: [],
  };
}

function slotSupports(storage: StorageSpec, slot: M2SlotSpec): boolean {
  return (
    storage.m2FormFactor !== undefined &&
    slot.formFactors.includes(storage.m2FormFactor) &&
    slot.interfaces.includes(storage.interface)
  );
}

function hasCompleteAssignment(
  devices: readonly StorageSpec[],
  slots: readonly M2SlotSpec[],
): boolean {
  const candidates = devices
    .map((device) => slots.filter((slot) => slotSupports(device, slot)))
    .sort((left, right) => left.length - right.length);
  const occupied = new Set<string>();

  function assign(index: number): boolean {
    if (index === candidates.length) return true;
    for (const slot of candidates[index] ?? []) {
      if (occupied.has(slot.slotId)) continue;
      occupied.add(slot.slotId);
      if (assign(index + 1)) return true;
      occupied.delete(slot.slotId);
    }
    return false;
  }

  return assign(0);
}

export const m2SlotCompatibilityRule: EngineRule = {
  ruleId: 'm2-slot-compatibility',
  capabilityId: 'storage',
  evaluate: ({ build }) => {
    const devices = partsOf(build.parts, 'STORAGE')
      .map((part) => part.spec)
      .filter(
        (spec): spec is StorageSpec & { m2FormFactor: NonNullable<StorageSpec['m2FormFactor']> } =>
          spec.m2FormFactor !== undefined,
      );
    if (devices.length === 0) {
      return {
        status: 'NOT_CHECKED',
        summary: 'No M.2 storage device is included in this build',
        reasons: [],
        evidenceIds: [],
      };
    }

    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!motherboard?.spec.m2Slots) {
      return unknown('Motherboard M.2 slot data is missing');
    }
    if (!hasCompleteAssignment(devices, motherboard.spec.m2Slots)) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'M.2 devices cannot be assigned to compatible slots',
        reasons: ['Slot count, interface, or form factor support is insufficient'],
        evidenceIds: [],
      };
    }
    return {
      status: 'PASS',
      summary: 'Every M.2 device has a compatible slot',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const m2SataSharingRule: EngineRule = {
  ruleId: 'm2-sata-sharing',
  capabilityId: 'storage-sharing',
  evaluate: ({ build }) => {
    const storageParts = partsOf(build.parts, 'STORAGE');
    const hasM2 = storageParts.some(
      ({ spec }) => spec.m2FormFactor !== undefined,
    );
    const hasSata = storageParts.some(({ spec }) => spec.interface === 'SATA');
    if (!hasM2 || !hasSata) {
      return {
        status: 'PASS',
        summary: 'No active M.2 and SATA sharing combination was found',
        reasons: [],
        evidenceIds: [],
      };
    }

    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!motherboard?.spec.m2Slots) {
      return unknown('Motherboard M.2 sharing data is missing');
    }
    const sharedPorts = motherboard.spec.m2Slots.flatMap(
      (slot) => slot.sharedSataPortIds ?? [],
    );
    if (sharedPorts.length > 0) {
      return {
        status: 'CONDITIONAL',
        summary: 'Selected M.2 storage may disable SATA ports',
        reasons: [`Potentially shared ports: ${sharedPorts.join(', ')}`],
        conditions: [
          {
            code: 'VERIFY_SATA_PORT_SHARING',
            message: '메인보드 설명서에서 M.2 슬롯과 SATA 포트 공유 조건을 확인하세요.',
          },
        ],
        evidenceIds: [],
      };
    }
    return {
      status: 'PASS',
      summary: 'No M.2 and SATA port sharing is declared',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const pcieSlotCompatibilityRule: EngineRule = {
  ruleId: 'pcie-slot-compatibility',
  capabilityId: 'pcie-slot',
  evaluate: ({ build, installationContext }) => {
    const [gpu] = partsOf(build.parts, 'GPU');
    if (!gpu) {
      return {
        status: 'NOT_CHECKED',
        summary: 'No GPU is included in this build',
        reasons: [],
        evidenceIds: [],
      };
    }
    if (
      gpu.spec.pcieGeneration === undefined ||
      gpu.spec.pcieLanes === undefined
    ) {
      return unknown('GPU PCIe requirements are missing');
    }

    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!motherboard?.spec.pcieSlots) {
      return unknown('Motherboard PCIe slot data is missing');
    }
    const occupied = new Set(installationContext.occupiedPcieSlotIds);
    const candidates = motherboard.spec.pcieSlots.filter(
      (slot) => !occupied.has(slot.slotId) && slot.lanes >= gpu.spec.pcieLanes!,
    );
    if (candidates.length === 0) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'No unoccupied PCIe slot has enough lanes for the GPU',
        reasons: [`GPU requires x${gpu.spec.pcieLanes}`],
        evidenceIds: [],
      };
    }
    if (
      candidates.every((slot) => slot.generation < gpu.spec.pcieGeneration!)
    ) {
      return {
        status: 'WARNING',
        summary: 'GPU will operate on an older PCIe generation',
        reasons: [`GPU Gen ${gpu.spec.pcieGeneration} exceeds available slot generation`],
        evidenceIds: [],
      };
    }
    return {
      status: 'PASS',
      summary: 'A compatible PCIe slot is available for the GPU',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const storageRules = [
  m2SlotCompatibilityRule,
  m2SataSharingRule,
  pcieSlotCompatibilityRule,
] as const;
