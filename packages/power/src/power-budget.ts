import type { CanonicalBuild, CanonicalPart } from '@pcpartcheck/core';

export interface PowerEstimationPolicy {
  readonly motherboardW: number;
  readonly memoryModuleW: number;
  readonly nvmeSsdW: number;
  readonly sataSsdW: number;
  readonly hddW: number;
  readonly caseFanW: number;
  readonly pumpW: number;
  readonly unknownPcieCardW: number;
}

export interface PsuSizingPolicy {
  readonly headroomRatio: number;
  readonly minimumReserveW: number;
  readonly roundingStepW: number;
}

export const DEFAULT_POWER_ESTIMATION_POLICY: PowerEstimationPolicy = {
  motherboardW: 70,
  memoryModuleW: 5,
  nvmeSsdW: 8,
  sataSsdW: 5,
  hddW: 10,
  caseFanW: 5,
  pumpW: 20,
  unknownPcieCardW: 25,
};

export const DEFAULT_PSU_SIZING_POLICY: PsuSizingPolicy = {
  headroomRatio: 0.2,
  minimumReserveW: 100,
  roundingStepW: 50,
};

export interface PowerPolicyEvidence {
  readonly evidenceId: string;
  readonly partId: string;
  readonly sourceKind: 'POLICY_DEFAULT';
  readonly sourceId: 'power-estimation-v1';
  readonly confidence: 'LOW';
  readonly allowanceKind:
    | 'MOTHERBOARD'
    | 'MEMORY_MODULE'
    | 'NVME_SSD'
    | 'SATA_SSD'
    | 'HDD'
    | 'CASE_FAN'
    | 'PUMP'
    | 'UNKNOWN_PCIE_CARD';
  readonly valueW: number;
}

export interface ComponentPowerLoad {
  readonly partId: string;
  readonly category: CanonicalPart['category'];
  readonly valueW: number;
  readonly source: 'CANONICAL_SPEC' | 'POLICY_DEFAULT';
}

export interface CalculatedPowerBudget {
  readonly status: 'CALCULATED';
  readonly estimatedPeakPowerW: number;
  readonly minimumPsuW: number;
  readonly calculatedRecommendedPsuW: number;
  readonly recommendedPsuW: number;
  readonly selectedBy: 'CALCULATED' | 'VENDOR';
  readonly vendorRecommendedPsuW?: number;
  readonly componentLoads: readonly ComponentPowerLoad[];
  readonly evidence: readonly PowerPolicyEvidence[];
}

export interface UnknownPowerBudget {
  readonly status: 'UNKNOWN';
  readonly reason: 'CPU_OR_GPU_PEAK_POWER_MISSING';
  readonly missingPartIds: readonly string[];
  readonly componentLoads: readonly ComponentPowerLoad[];
  readonly evidence: readonly PowerPolicyEvidence[];
}

export type PowerBudgetResult = CalculatedPowerBudget | UnknownPowerBudget;

function ceilToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function assertPolicies(
  estimation: PowerEstimationPolicy,
  sizing: PsuSizingPolicy,
): void {
  if (
    Object.values(estimation).some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    throw new RangeError('Power estimation allowances must be non-negative');
  }
  if (
    !Number.isFinite(sizing.headroomRatio) ||
    sizing.headroomRatio < 0 ||
    sizing.headroomRatio >= 1 ||
    !Number.isFinite(sizing.minimumReserveW) ||
    sizing.minimumReserveW < 0 ||
    !Number.isFinite(sizing.roundingStepW) ||
    sizing.roundingStepW <= 0
  ) {
    throw new RangeError('Invalid PSU sizing policy');
  }
}

export function calculatePowerBudget(
  build: CanonicalBuild,
  estimationPolicy: PowerEstimationPolicy = DEFAULT_POWER_ESTIMATION_POLICY,
  sizingPolicy: PsuSizingPolicy = DEFAULT_PSU_SIZING_POLICY,
): PowerBudgetResult {
  assertPolicies(estimationPolicy, sizingPolicy);
  const componentLoads: ComponentPowerLoad[] = [];
  const evidence: PowerPolicyEvidence[] = [];
  const missingPartIds: string[] = [];

  function canonical(part: CanonicalPart, valueW: number): void {
    componentLoads.push({
      partId: part.partId,
      category: part.category,
      valueW,
      source: 'CANONICAL_SPEC',
    });
  }

  function policyDefault(
    part: CanonicalPart,
    allowanceKind: PowerPolicyEvidence['allowanceKind'],
    valueW: number,
  ): void {
    componentLoads.push({
      partId: part.partId,
      category: part.category,
      valueW,
      source: 'POLICY_DEFAULT',
    });
    evidence.push({
      evidenceId: `power-policy:${part.partId}:${allowanceKind}`,
      partId: part.partId,
      sourceKind: 'POLICY_DEFAULT',
      sourceId: 'power-estimation-v1',
      confidence: 'LOW',
      allowanceKind,
      valueW,
    });
  }

  for (const part of build.parts) {
    switch (part.category) {
      case 'CPU':
      case 'GPU':
        if (part.spec.peakPowerW === undefined) missingPartIds.push(part.partId);
        else canonical(part, part.spec.peakPowerW);
        break;
      case 'MOTHERBOARD':
        policyDefault(part, 'MOTHERBOARD', estimationPolicy.motherboardW);
        break;
      case 'MEMORY':
        policyDefault(
          part,
          'MEMORY_MODULE',
          part.spec.moduleCount * estimationPolicy.memoryModuleW,
        );
        break;
      case 'STORAGE': {
        if (part.spec.peakPowerW !== undefined) {
          canonical(part, part.spec.peakPowerW);
          break;
        }
        const allowance =
          part.spec.storageType === 'NVME_SSD'
            ? (['NVME_SSD', estimationPolicy.nvmeSsdW] as const)
            : part.spec.storageType === 'SATA_SSD'
              ? (['SATA_SSD', estimationPolicy.sataSsdW] as const)
              : (['HDD', estimationPolicy.hddW] as const);
        policyDefault(part, allowance[0], allowance[1]);
        break;
      }
      case 'CASE_FAN':
        if (part.spec.peakPowerW !== undefined) canonical(part, part.spec.peakPowerW);
        else policyDefault(part, 'CASE_FAN', estimationPolicy.caseFanW);
        break;
      case 'CPU_COOLER':
        if (part.spec.peakPowerW !== undefined) canonical(part, part.spec.peakPowerW);
        else if (part.spec.coolerType !== 'AIR') {
          policyDefault(part, 'PUMP', estimationPolicy.pumpW);
        }
        break;
      case 'PC_CASE':
      case 'PSU':
        break;
    }
  }

  if (missingPartIds.length > 0) {
    return {
      status: 'UNKNOWN',
      reason: 'CPU_OR_GPU_PEAK_POWER_MISSING',
      missingPartIds,
      componentLoads,
      evidence,
    };
  }

  const estimatedPeakPowerW = componentLoads.reduce(
    (total, load) => total + load.valueW,
    0,
  );
  const minimumPsuW = ceilToStep(
    estimatedPeakPowerW + sizingPolicy.minimumReserveW,
    sizingPolicy.roundingStepW,
  );
  const calculatedRecommendedPsuW = ceilToStep(
    Math.max(
      minimumPsuW,
      estimatedPeakPowerW / (1 - sizingPolicy.headroomRatio),
    ),
    sizingPolicy.roundingStepW,
  );
  const vendorRecommendedPsuW = build.parts
    .filter((part) => part.category === 'GPU')
    .reduce<number | undefined>(
      (maximum, part) =>
        part.spec.vendorRecommendedPsuW === undefined
          ? maximum
          : Math.max(maximum ?? 0, part.spec.vendorRecommendedPsuW),
      undefined,
    );
  const recommendedPsuW = ceilToStep(
    Math.max(calculatedRecommendedPsuW, vendorRecommendedPsuW ?? 0),
    sizingPolicy.roundingStepW,
  );

  return {
    status: 'CALCULATED',
    estimatedPeakPowerW,
    minimumPsuW,
    calculatedRecommendedPsuW,
    recommendedPsuW,
    selectedBy:
      (vendorRecommendedPsuW ?? 0) > calculatedRecommendedPsuW
        ? 'VENDOR'
        : 'CALCULATED',
    ...(vendorRecommendedPsuW === undefined ? {} : { vendorRecommendedPsuW }),
    componentLoads,
    evidence,
  };
}
