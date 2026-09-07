import type {
  FieldEvidenceIssueType,
  FieldEvidenceQuery,
  FieldEvidenceRecord,
  FieldMeasurement,
} from '@pcpartcheck/evidence';
import { classifyFieldEvidenceMatch } from '@pcpartcheck/evidence';

export type SimilarityFeature =
  | { readonly kind: 'PARTS'; readonly weight: number }
  | { readonly kind: 'GPU_ORIENTATION'; readonly weight: number }
  | { readonly kind: 'RADIATORS'; readonly weight: number }
  | { readonly kind: 'HDD_CAGES'; readonly weight: number }
  | { readonly kind: 'PCIE_POWER'; readonly weight: number }
  | {
      readonly kind: 'MEASUREMENT';
      readonly fieldPath: string;
      readonly weight: number;
      readonly tolerance: number;
    };

export interface SimilarityProfile {
  readonly issueType: FieldEvidenceIssueType;
  readonly features: readonly SimilarityFeature[];
}

export interface SimilarityQuery extends FieldEvidenceQuery {
  readonly measurements?: readonly FieldMeasurement[];
}

export interface SimilarFieldEvidenceMatch {
  readonly evidenceId: string;
  readonly issueType: FieldEvidenceIssueType;
  readonly similarityScore: number;
  readonly matchedFields: readonly string[];
  readonly differences: readonly string[];
  readonly reason: string;
}

export interface RankSimilarFieldEvidenceInput {
  readonly query: SimilarityQuery;
  readonly records: readonly FieldEvidenceRecord[];
  readonly profiles?: Readonly<Partial<Record<FieldEvidenceIssueType, SimilarityProfile>>>;
}

export const DEFAULT_SIMILARITY_PROFILES: Readonly<
  Record<FieldEvidenceIssueType, SimilarityProfile>
> = {
  PHYSICAL_CLEARANCE: {
    issueType: 'PHYSICAL_CLEARANCE',
    features: [
      { kind: 'PARTS', weight: 3 },
      { kind: 'GPU_ORIENTATION', weight: 1 },
      { kind: 'RADIATORS', weight: 5 },
      { kind: 'HDD_CAGES', weight: 2 },
      { kind: 'MEASUREMENT', fieldPath: 'gpu.lengthMm', weight: 5, tolerance: 100 },
      {
        kind: 'MEASUREMENT',
        fieldPath: 'case.maxGpuLengthMm',
        weight: 4,
        tolerance: 100,
      },
    ],
  },
  RADIATOR_CLEARANCE: {
    issueType: 'RADIATOR_CLEARANCE',
    features: [
      { kind: 'PARTS', weight: 3 },
      { kind: 'RADIATORS', weight: 7 },
      {
        kind: 'MEASUREMENT',
        fieldPath: 'radiator.stackThicknessMm',
        weight: 5,
        tolerance: 20,
      },
    ],
  },
  MEMORY_CLEARANCE: {
    issueType: 'MEMORY_CLEARANCE',
    features: [
      { kind: 'PARTS', weight: 4 },
      {
        kind: 'MEASUREMENT',
        fieldPath: 'memory.heightMm',
        weight: 5,
        tolerance: 15,
      },
      {
        kind: 'MEASUREMENT',
        fieldPath: 'cooler.memoryClearanceMm',
        weight: 5,
        tolerance: 15,
      },
    ],
  },
  POWER_CONNECTOR: {
    issueType: 'POWER_CONNECTOR',
    features: [
      { kind: 'PARTS', weight: 4 },
      { kind: 'PCIE_POWER', weight: 7 },
    ],
  },
  BIOS_POST: {
    issueType: 'BIOS_POST',
    features: [
      { kind: 'PARTS', weight: 8 },
      { kind: 'GPU_ORIENTATION', weight: 1 },
    ],
  },
  STORAGE_RESOURCE: {
    issueType: 'STORAGE_RESOURCE',
    features: [
      { kind: 'PARTS', weight: 6 },
      { kind: 'PCIE_POWER', weight: 1 },
    ],
  },
  THERMAL: {
    issueType: 'THERMAL',
    features: [
      { kind: 'PARTS', weight: 4 },
      { kind: 'RADIATORS', weight: 4 },
      { kind: 'GPU_ORIENTATION', weight: 1 },
    ],
  },
};

interface FeatureScore {
  readonly score: number;
  readonly matchedFields: readonly string[];
  readonly differences: readonly string[];
}

function exactFeature(field: string, equal: boolean): FeatureScore {
  return {
    score: equal ? 1 : 0,
    matchedFields: equal ? [field] : [],
    differences: equal ? [] : [field],
  };
}

function scoreParts(
  query: SimilarityQuery,
  record: FieldEvidenceRecord,
): FeatureScore {
  if (query.parts.length === 0) return exactFeature('parts', false);
  const matchedFields: string[] = [];
  const differences: string[] = [];
  for (const queryPart of query.parts) {
    const match = record.parts.some(
      (recordPart) =>
        recordPart.category === queryPart.category &&
        recordPart.partId === queryPart.partId,
    );
    (match ? matchedFields : differences).push(`parts.${queryPart.category}`);
  }
  return {
    score: matchedFields.length / query.parts.length,
    matchedFields,
    differences,
  };
}

function ordered(value: readonly unknown[]): string {
  return JSON.stringify(
    [...value].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
  );
}

function scoreRadiators(
  query: SimilarityQuery,
  record: FieldEvidenceRecord,
): FeatureScore {
  const queryRadiators = query.installationContext.radiators;
  const recordRadiators = record.installationContext.radiators;
  if (queryRadiators.length === 0 || recordRadiators.length === 0) {
    return exactFeature(
      'installationContext.radiators',
      queryRadiators.length === recordRadiators.length,
    );
  }

  const maximumCount = Math.max(queryRadiators.length, recordRadiators.length);
  let points = 0;
  for (const queryRadiator of queryRadiators) {
    const samePosition = recordRadiators.find(
      (recordRadiator) => recordRadiator.position === queryRadiator.position,
    );
    if (!samePosition) continue;
    points += 0.4;
    if (samePosition.sizeMm === queryRadiator.sizeMm) points += 0.3;
    if (samePosition.radiatorThicknessMm === queryRadiator.radiatorThicknessMm) {
      points += 0.15;
    }
    if (samePosition.fanThicknessMm === queryRadiator.fanThicknessMm) points += 0.15;
  }
  const equal = ordered(queryRadiators) === ordered(recordRadiators);
  return {
    score: Math.min(1, points / maximumCount),
    matchedFields: equal ? ['installationContext.radiators'] : [],
    differences: equal ? [] : ['installationContext.radiators'],
  };
}

function scoreMeasurement(
  feature: Extract<SimilarityFeature, { kind: 'MEASUREMENT' }>,
  query: SimilarityQuery,
  record: FieldEvidenceRecord,
): FeatureScore {
  const queryMeasurement = query.measurements?.find(
    (measurement) => measurement.fieldPath === feature.fieldPath,
  );
  const recordMeasurement = record.measurements?.find(
    (measurement) => measurement.fieldPath === feature.fieldPath,
  );
  const field = `measurements.${feature.fieldPath}`;
  if (!queryMeasurement || !recordMeasurement || queryMeasurement.unit !== recordMeasurement.unit) {
    return exactFeature(field, false);
  }
  if (
    typeof queryMeasurement.value === 'number' &&
    typeof recordMeasurement.value === 'number'
  ) {
    const delta = Math.abs(queryMeasurement.value - recordMeasurement.value);
    return {
      score: Math.max(0, 1 - delta / feature.tolerance),
      matchedFields: delta === 0 ? [field] : [],
      differences: delta === 0 ? [] : [field],
    };
  }
  return exactFeature(field, queryMeasurement.value === recordMeasurement.value);
}

function scoreFeature(
  feature: SimilarityFeature,
  query: SimilarityQuery,
  record: FieldEvidenceRecord,
): FeatureScore {
  switch (feature.kind) {
    case 'PARTS':
      return scoreParts(query, record);
    case 'GPU_ORIENTATION':
      return exactFeature(
        'installationContext.gpuOrientation',
        query.installationContext.gpuOrientation ===
          record.installationContext.gpuOrientation,
      );
    case 'RADIATORS':
      return scoreRadiators(query, record);
    case 'HDD_CAGES':
      return exactFeature(
        'installationContext.hddCages',
        ordered(query.installationContext.hddCages) ===
          ordered(record.installationContext.hddCages),
      );
    case 'PCIE_POWER':
      return exactFeature(
        'installationContext.pciePower',
        JSON.stringify(query.installationContext.pciePower) ===
          JSON.stringify(record.installationContext.pciePower),
      );
    case 'MEASUREMENT':
      return scoreMeasurement(feature, query, record);
  }
}

function scoreRecord(
  query: SimilarityQuery,
  record: FieldEvidenceRecord,
  profile: SimilarityProfile,
): SimilarFieldEvidenceMatch {
  let weightedScore = 0;
  let totalWeight = 0;
  const matchedFields = new Set<string>();
  const differences = new Set<string>();
  for (const feature of profile.features) {
    const result = scoreFeature(feature, query, record);
    weightedScore += result.score * feature.weight;
    totalWeight += feature.weight;
    result.matchedFields.forEach((field) => matchedFields.add(field));
    result.differences.forEach((field) => differences.add(field));
  }

  const similarityScore = totalWeight === 0 ? 0 : weightedScore / totalWeight;
  return {
    evidenceId: record.evidenceId,
    issueType: record.issueType,
    similarityScore: Number(similarityScore.toFixed(6)),
    matchedFields: [...matchedFields].sort(),
    differences: [...differences].sort(),
    reason: `${matchedFields.size} fields matched and ${differences.size} differed under the ${profile.issueType} profile`,
  };
}

export function rankSimilarFieldEvidence(
  input: RankSimilarFieldEvidenceInput,
): readonly SimilarFieldEvidenceMatch[] {
  const profile =
    input.profiles?.[input.query.issueType] ??
    DEFAULT_SIMILARITY_PROFILES[input.query.issueType];

  return input.records
    .filter(
      (record) =>
        record.status === 'APPROVED' &&
        record.issueType === input.query.issueType &&
        classifyFieldEvidenceMatch(record, input.query) === 'SIMILAR',
    )
    .map((record) => scoreRecord(input.query, record, profile))
    .sort(
      (left, right) =>
        right.similarityScore - left.similarityScore ||
        left.evidenceId.localeCompare(right.evidenceId),
    )
    .slice(0, 3);
}
