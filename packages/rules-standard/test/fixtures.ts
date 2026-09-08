import type {
  CanonicalPart,
  CompatibilityRuleContext,
  InstallationContext,
} from '@pcpartcheck/core';

export const installationContext: InstallationContext = {
  schemaVersion: '2.0.0',
  radiators: [],
  hddCages: [],
  gpuOrientation: 'HORIZONTAL',
  occupiedPcieSlotIds: [],
  pciePower: {
    independentCableCount: 0,
    native12VhpwrCableCount: 0,
    native12V2x6CableCount: 0,
    adapterUsed: false,
  },
};

export function context(
  parts: readonly CanonicalPart[],
  capabilityId = 'fixture',
  config?: Readonly<Record<string, string | number | boolean | null>>,
  currentInstallationContext: InstallationContext = installationContext,
): CompatibilityRuleContext {
  return {
    build: { schemaVersion: '3.0.0', parts: [...parts] },
    intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
    installationContext: currentInstallationContext,
    policy: {
      capabilityId,
      mode: 'REQUIRED',
      ...(config ? { config } : {}),
    },
  };
}

export function cpu(socket = 'AM5'): CanonicalPart {
  return {
    schemaVersion: '3.0.0',
    partId: '11111111-1111-4111-8111-111111111111',
    category: 'CPU',
    manufacturer: 'Example',
    model: 'CPU',
    status: 'ACTIVE',
    spec: { socket, coreCount: 8, threadCount: 16, peakPowerW: 120 },
  };
}

export function motherboard(
  overrides: Partial<{
    socket: string;
    formFactor: 'ATX' | 'MICRO_ATX' | 'MINI_ITX' | 'E_ATX';
    memoryTechnologies: ('DDR3' | 'DDR4' | 'DDR5')[];
    memorySlots: number;
    maxMemoryGb: number;
  }> = {},
): CanonicalPart {
  return {
    schemaVersion: '3.0.0',
    partId: '22222222-2222-4222-8222-222222222222',
    category: 'MOTHERBOARD',
    manufacturer: 'Example',
    model: 'Board',
    status: 'ACTIVE',
    spec: {
      socket: overrides.socket ?? 'AM5',
      formFactor: overrides.formFactor ?? 'ATX',
      memoryTechnologies: overrides.memoryTechnologies ?? ['DDR5'],
      ...(overrides.memorySlots === undefined
        ? {}
        : { memorySlots: overrides.memorySlots }),
      ...(overrides.maxMemoryGb === undefined
        ? {}
        : { maxMemoryGb: overrides.maxMemoryGb }),
    },
  };
}

export function memory(
  technology: 'DDR3' | 'DDR4' | 'DDR5' = 'DDR5',
  moduleCount = 2,
  capacityPerModuleGb = 16,
): CanonicalPart {
  return {
    schemaVersion: '3.0.0',
    partId: '33333333-3333-4333-8333-333333333333',
    category: 'MEMORY',
    manufacturer: 'Example',
    model: 'Memory',
    status: 'ACTIVE',
    spec: {
      technology,
      formFactor: 'DIMM',
      moduleCount,
      capacityPerModuleGb,
      dataRateMtps: 6000,
    },
  };
}

export function pcCase(
  supportedMotherboardFormFactors: ('ATX' | 'MICRO_ATX' | 'MINI_ITX' | 'E_ATX')[] = [
    'ATX',
  ],
): CanonicalPart {
  return {
    schemaVersion: '3.0.0',
    partId: '44444444-4444-4444-8444-444444444444',
    category: 'PC_CASE',
    manufacturer: 'Example',
    model: 'Case',
    status: 'ACTIVE',
    spec: { supportedMotherboardFormFactors },
  };
}

export function gpu(lengthMm?: number): CanonicalPart {
  return {
    schemaVersion: '3.0.0',
    partId: '55555555-5555-4555-8555-555555555555',
    category: 'GPU',
    manufacturer: 'Example',
    model: 'GPU',
    status: 'ACTIVE',
    spec: { ...(lengthMm === undefined ? {} : { lengthMm }) },
  };
}

export function cpuCooler(
  overrides: Partial<{
    coolerType: 'AIR' | 'AIO' | 'CUSTOM_LOOP';
    supportedSockets: string[];
    heightMm: number;
  }> = {},
): CanonicalPart {
  return {
    schemaVersion: '3.0.0',
    partId: '66666666-6666-4666-8666-666666666666',
    category: 'CPU_COOLER',
    manufacturer: 'Example',
    model: 'Cooler',
    status: 'ACTIVE',
    spec: {
      coolerType: overrides.coolerType ?? 'AIR',
      supportedSockets: overrides.supportedSockets ?? ['AM5'],
      ...(overrides.heightMm === undefined ? {} : { heightMm: overrides.heightMm }),
    },
  };
}

export function psu(lengthMm?: number): CanonicalPart {
  return {
    schemaVersion: '3.0.0',
    partId: '77777777-7777-4777-8777-777777777777',
    category: 'PSU',
    manufacturer: 'Example',
    model: 'PSU',
    status: 'ACTIVE',
    spec: {
      formFactor: 'ATX',
      ratedPowerW: 850,
      powerConnectors: [],
      ...(lengthMm === undefined ? {} : { lengthMm }),
    },
  };
}
