import type {
  CanonicalPart,
  CompatibilityCheckInput,
  CompatibilityDecision,
  CompatibilityStatus,
  InstallationContext,
} from '@pcpartcheck/core';

export interface DemoScenario {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly ruleIds: readonly string[];
  readonly input: CompatibilityCheckInput;
  readonly expectedResult: {
    readonly status: CompatibilityStatus;
    readonly decision: CompatibilityDecision;
  };
}

const baseInstallationContext: InstallationContext = {
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

const cpu: CanonicalPart = {
  schemaVersion: '2.0.0',
  partId: '10000000-0000-4000-8000-000000000001',
  category: 'CPU',
  manufacturer: '샘플 제조사',
  model: 'Demo CPU 120W',
  status: 'ACTIVE',
  spec: { socket: 'AM5', coreCount: 8, threadCount: 16, peakPowerW: 120 },
};

const motherboard: CanonicalPart = {
  schemaVersion: '2.0.0',
  partId: '10000000-0000-4000-8000-000000000002',
  category: 'MOTHERBOARD',
  manufacturer: '샘플 제조사',
  model: 'Demo B650 ATX',
  status: 'ACTIVE',
  spec: {
    socket: 'AM5',
    chipset: 'B650',
    formFactor: 'ATX',
    memoryTechnologies: ['DDR5'],
    memorySlots: 4,
    maxMemoryGb: 128,
    supportedDataRatesMtps: [4800, 5600, 6000],
    powerConnectorRequirements: [
      { type: 'ATX_24_PIN', count: 1, mode: 'REQUIRED' },
      { type: 'EPS_8_PIN', count: 1, mode: 'REQUIRED' },
    ],
    rgbHeaders: [{ type: 'RGB_12V_4_PIN', count: 1 }],
  },
};

const memory: CanonicalPart = {
  schemaVersion: '2.0.0',
  partId: '10000000-0000-4000-8000-000000000003',
  category: 'MEMORY',
  manufacturer: '샘플 제조사',
  model: 'Demo DDR5-6000 32GB',
  status: 'ACTIVE',
  spec: {
    technology: 'DDR5',
    formFactor: 'DIMM',
    moduleCount: 2,
    capacityPerModuleGb: 16,
    dataRateMtps: 6000,
  },
};

const pcCase: CanonicalPart = {
  schemaVersion: '2.0.0',
  partId: '10000000-0000-4000-8000-000000000004',
  category: 'PC_CASE',
  manufacturer: '샘플 제조사',
  model: 'Demo Mid Tower',
  status: 'ACTIVE',
  spec: {
    supportedMotherboardFormFactors: ['ATX', 'MICRO_ATX', 'MINI_ITX'],
    supportedPsuFormFactors: ['ATX'],
    maxGpuLengthMm: 380,
    maxCpuCoolerHeightMm: 170,
    maxPsuLengthMm: 200,
    radiatorMounts: [
      {
        position: 'FRONT',
        supportedSizesMm: [240, 280, 360],
        maxCombinedThicknessMm: 60,
      },
    ],
  },
};

const gpu: CanonicalPart = {
  schemaVersion: '2.0.0',
  partId: '10000000-0000-4000-8000-000000000005',
  category: 'GPU',
  manufacturer: '샘플 제조사',
  model: 'Demo GPU 330 mm',
  status: 'ACTIVE',
  spec: {
    lengthMm: 330,
    peakPowerW: 300,
    vendorRecommendedPsuW: 750,
    powerConnectorRequirements: [
      {
        type: 'PCIE_8_PIN',
        count: 2,
        mode: 'REQUIRED',
        independentCableCount: 2,
      },
    ],
  },
};

const psu: CanonicalPart = {
  schemaVersion: '2.0.0',
  partId: '10000000-0000-4000-8000-000000000006',
  category: 'PSU',
  manufacturer: '샘플 제조사',
  model: 'Demo PSU 850W',
  status: 'ACTIVE',
  spec: {
    formFactor: 'ATX',
    ratedPowerW: 850,
    lengthMm: 160,
    powerConnectors: [
      { type: 'ATX_24_PIN', count: 1 },
      { type: 'EPS_8_PIN', count: 1 },
      { type: 'PCIE_8_PIN', count: 3 },
    ],
  },
};

const argbFan: CanonicalPart = {
  schemaVersion: '2.0.0',
  partId: '10000000-0000-4000-8000-000000000007',
  category: 'CASE_FAN',
  manufacturer: '샘플 제조사',
  model: 'Demo ARGB Fan',
  status: 'ACTIVE',
  spec: {
    diameterMm: 120,
    thicknessMm: 25,
    connector: 'PWM_4_PIN',
    rgbConnector: 'ARGB_5V_3_PIN',
  },
};

function input(
  parts: readonly CanonicalPart[],
  capabilityModes: Readonly<Record<string, 'REQUIRED' | 'ADVISORY'>>,
  installationContext: InstallationContext = baseInstallationContext,
): CompatibilityCheckInput {
  return {
    build: { schemaVersion: '2.0.0', parts: [...parts] },
    intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
    installationContext,
    policyProfile: {
      profileId: 'synthetic-demo',
      policyVersion: '1.0.0',
      capabilities: Object.entries(capabilityModes).map(
        ([capabilityId, mode]) => ({ capabilityId, mode }),
      ),
    },
    evidenceSnapshot: { source: 'SYNTHETIC_DEMO' },
  };
}

export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    id: 'compatible-platform',
    title: '기본 부품이 모두 맞는 구성',
    summary: 'CPU 소켓, 메모리 규격, 메인보드 크기를 함께 확인합니다.',
    ruleIds: ['cpu-socket', 'memory-generation', 'motherboard-form-factor'],
    input: input(
      [cpu, motherboard, memory, pcCase],
      { socket: 'REQUIRED', 'memory-generation': 'REQUIRED', 'form-factor': 'REQUIRED' },
    ),
    expectedResult: { status: 'PASS', decision: 'ALLOW' },
  },
  {
    id: 'socket-mismatch',
    title: 'CPU와 메인보드 소켓이 다른 구성',
    summary: '필수 소켓 규칙이 실패해 조립을 막는 사례입니다.',
    ruleIds: ['cpu-socket'],
    input: input(
      [cpu, { ...motherboard, spec: { ...motherboard.spec, socket: 'LGA1851' } }],
      { socket: 'REQUIRED' },
    ),
    expectedResult: { status: 'INCOMPATIBLE', decision: 'BLOCK' },
  },
  {
    id: 'radiator-gpu-interference',
    title: '전면 라디에이터와 그래픽카드가 겹치는 구성',
    summary: '라디에이터와 팬 두께를 뺀 실제 그래픽카드 공간을 계산합니다.',
    ruleIds: ['gpu-clearance'],
    input: input(
      [gpu, pcCase],
      { 'gpu-clearance': 'REQUIRED' },
      {
        ...baseInstallationContext,
        radiators: [
          {
            position: 'FRONT',
            sizeMm: 360,
            radiatorThicknessMm: 30,
            fanThicknessMm: 25,
          },
        ],
      },
    ),
    expectedResult: { status: 'INCOMPATIBLE', decision: 'BLOCK' },
  },
  {
    id: 'psu-connector-shortage',
    title: '파워 용량은 충분하지만 케이블이 부족한 구성',
    summary: '정격 출력과 별개로 GPU 전원 커넥터와 독립 케이블 수를 확인합니다.',
    ruleIds: ['psu-connectors'],
    input: input(
      [gpu, motherboard, {
        ...psu,
        spec: {
          ...psu.spec,
          powerConnectors: [
            { type: 'ATX_24_PIN', count: 1 },
            { type: 'EPS_8_PIN', count: 1 },
            { type: 'PCIE_8_PIN', count: 1 },
          ],
        },
      }],
      { 'psu-connector': 'REQUIRED' },
    ),
    expectedResult: { status: 'INCOMPATIBLE', decision: 'BLOCK' },
  },
  {
    id: 'advisory-rgb-mismatch',
    title: 'ARGB 헤더가 맞지 않는 구성',
    summary: '핵심 부품은 맞지만 조명 연결에는 별도 컨트롤러가 필요합니다.',
    ruleIds: ['cpu-socket', 'rgb-header'],
    input: input(
      [cpu, motherboard, argbFan],
      { socket: 'REQUIRED', rgb: 'ADVISORY' },
    ),
    expectedResult: { status: 'INCOMPATIBLE', decision: 'ALLOW_WITH_WARNING' },
  },
  {
    id: 'missing-clearance-data',
    title: '그래픽카드 길이 정보가 없는 구성',
    summary: '근거가 부족할 때 통과로 추측하지 않고 검토가 필요하다고 표시합니다.',
    ruleIds: ['gpu-clearance'],
    input: input(
      [
        {
          ...gpu,
          spec: {
            peakPowerW: 300,
            vendorRecommendedPsuW: 750,
            powerConnectorRequirements: [
              {
                type: 'PCIE_8_PIN',
                count: 2,
                mode: 'REQUIRED',
                independentCableCount: 2,
              },
            ],
          },
        },
        pcCase,
      ],
      { 'gpu-clearance': 'REQUIRED' },
    ),
    expectedResult: { status: 'UNKNOWN', decision: 'REVIEW' },
  },
];
