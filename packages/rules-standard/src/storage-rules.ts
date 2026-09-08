import type {
  EngineRule,
  M2SlotSpec,
  PcieSlotSpec,
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
    const devices = [
      ...partsOf(build.parts, 'GPU'),
      ...partsOf(build.parts, 'PCIE_CARD'),
    ].map((part) => ({
      partId: part.partId,
      physicalConnectorLanes: part.spec.physicalConnectorLanes,
      maxLinkWidthLanes: part.spec.maxLinkWidthLanes,
      pcieGeneration: part.spec.pcieGeneration,
    }));
    if (devices.length === 0) {
      return {
        status: 'NOT_CHECKED',
        summary: 'No PCIe add-in device is included in this build',
        reasons: [],
        evidenceIds: [],
      };
    }
    if (
      devices.some((device) => device.physicalConnectorLanes === undefined)
    ) {
      return unknown('PCIe physical connector size is missing');
    }

    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!motherboard?.spec.pcieSlots) {
      return unknown('Motherboard PCIe slot data is missing');
    }
    const occupied = new Set(installationContext.occupiedPcieSlotIds);
    const assignment = findPcieAssignment(
      devices as readonly CompletePcieDevice[],
      motherboard.spec.pcieSlots.filter((slot) => !occupied.has(slot.slotId)),
    );
    if (!assignment) {
      return {
        status: 'INCOMPATIBLE',
        summary: 'PCIe devices cannot be assigned to physical slots',
        reasons: ['An unoccupied slot with sufficient physical lanes is required'],
        evidenceIds: [],
      };
    }
    return {
      status: 'PASS',
      summary: 'PCIe devices fit the available physical slots',
      reasons: [],
      evidenceIds: [],
    };
  },
};

interface CompletePcieDevice {
  readonly partId: string;
  readonly physicalConnectorLanes: number;
  readonly maxLinkWidthLanes?: number;
  readonly pcieGeneration?: number;
}

interface PcieAssignment {
  readonly device: CompletePcieDevice;
  readonly slot: PcieSlotSpec;
}

function findPcieAssignment(
  devices: readonly CompletePcieDevice[],
  slots: readonly PcieSlotSpec[],
): readonly PcieAssignment[] | undefined {
  const orderedDevices = [...devices].sort(
    (left, right) => right.physicalConnectorLanes - left.physicalConnectorLanes,
  );
  const occupied = new Set<string>();
  const assignment: PcieAssignment[] = [];

  function assign(index: number): boolean {
    const device = orderedDevices[index];
    if (!device) return true;
    const candidates = slots
      .filter(
        (slot) =>
          !occupied.has(slot.slotId) &&
          slot.physicalLanes >= device.physicalConnectorLanes,
      )
      .sort(
        (left, right) =>
          right.electricalLanes - left.electricalLanes ||
          right.generation - left.generation,
      );
    for (const slot of candidates) {
      occupied.add(slot.slotId);
      assignment.push({ device, slot });
      if (assign(index + 1)) return true;
      assignment.pop();
      occupied.delete(slot.slotId);
    }
    return false;
  }

  return assign(0) ? assignment : undefined;
}

export const pcieBandwidthAdvisoryRule: EngineRule = {
  ruleId: 'pcie-bandwidth-advisory',
  capabilityId: 'pcie-bandwidth',
  evaluate: ({ build, installationContext }) => {
    const devices = [
      ...partsOf(build.parts, 'GPU'),
      ...partsOf(build.parts, 'PCIE_CARD'),
    ].map((part) => ({
      partId: part.partId,
      physicalConnectorLanes: part.spec.physicalConnectorLanes,
      maxLinkWidthLanes: part.spec.maxLinkWidthLanes,
      pcieGeneration: part.spec.pcieGeneration,
    }));
    if (devices.length === 0) {
      return {
        status: 'NOT_CHECKED',
        summary: 'No PCIe bandwidth requires evaluation',
        reasons: [],
        evidenceIds: [],
      };
    }
    if (
      devices.some(
        (device) =>
          device.physicalConnectorLanes === undefined ||
          device.maxLinkWidthLanes === undefined ||
          device.pcieGeneration === undefined,
      )
    ) {
      return unknown('PCIe bandwidth capability data is missing');
    }
    const [motherboard] = partsOf(build.parts, 'MOTHERBOARD');
    if (!motherboard?.spec.pcieSlots) {
      return unknown('Motherboard PCIe slot data is missing');
    }
    const occupied = new Set(installationContext.occupiedPcieSlotIds);
    const assignment = findPcieAssignment(
      devices as readonly Required<CompletePcieDevice>[],
      motherboard.spec.pcieSlots.filter((slot) => !occupied.has(slot.slotId)),
    );
    if (!assignment) {
      return {
        status: 'NOT_CHECKED',
        summary: 'PCIe bandwidth was not evaluated because physical assignment failed',
        reasons: [],
        evidenceIds: [],
      };
    }
    const limited = assignment.filter(
      ({ device, slot }) =>
        slot.electricalLanes < (device.maxLinkWidthLanes ?? 0) ||
        slot.generation < (device.pcieGeneration ?? 0),
    );
    if (limited.length > 0) {
      return {
        status: 'WARNING',
        summary: 'One or more PCIe devices will use a lower link capability',
        reasons: limited.map(
          ({ device, slot }) =>
            `${device.partId} uses Gen ${slot.generation} x${slot.electricalLanes}`,
        ),
        evidenceIds: [],
      };
    }
    return {
      status: 'PASS',
      summary: 'PCIe slot bandwidth meets device link capabilities',
      reasons: [],
      evidenceIds: [],
    };
  },
};

export const storageRules = [
  m2SlotCompatibilityRule,
  m2SataSharingRule,
  pcieSlotCompatibilityRule,
  pcieBandwidthAdvisoryRule,
] as const;
