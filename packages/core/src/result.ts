import type { CapabilityMode } from './capability.js';
import type { CompatibilityStatus, RuleEvaluation } from './rule.js';

export type CompatibilityDecision =
  | 'ALLOW'
  | 'ALLOW_WITH_WARNING'
  | 'ALLOW_IF_CONDITIONS_MET'
  | 'REVIEW'
  | 'BLOCK'
  | 'NO_DECISION';

export interface RuleResult extends RuleEvaluation {
  readonly ruleId: string;
  readonly capabilityId: string;
  readonly policyMode: CapabilityMode;
}

export interface ActiveCoverageBucket {
  readonly total: number;
  readonly evaluated: number;
  readonly unknown: number;
  readonly notChecked: number;
}

export interface DisabledCoverageBucket {
  readonly total: number;
  readonly notChecked: number;
}

export interface CompatibilityCoverage {
  readonly required: ActiveCoverageBucket;
  readonly advisory: ActiveCoverageBucket;
  readonly disabled: DisabledCoverageBucket;
}

export interface CompatibilityIssueGroups {
  readonly blockingRuleIds: readonly string[];
  readonly reviewRuleIds: readonly string[];
  readonly advisoryRuleIds: readonly string[];
}

export interface AggregatedCompatibilityResult {
  readonly status: CompatibilityStatus;
  readonly decision: CompatibilityDecision;
  readonly coverage: CompatibilityCoverage;
  readonly issues: CompatibilityIssueGroups;
  readonly ruleResults: readonly RuleResult[];
}

interface MutableActiveCoverageBucket {
  total: number;
  evaluated: number;
  unknown: number;
  notChecked: number;
}

const statusRank: Readonly<Record<CompatibilityStatus, number>> = {
  NOT_CHECKED: 0,
  PASS: 1,
  WARNING: 2,
  CONDITIONAL: 3,
  UNKNOWN: 4,
  REVIEW_REQUIRED: 5,
  INCOMPATIBLE: 6,
};

function emptyActiveBucket(): MutableActiveCoverageBucket {
  return { total: 0, evaluated: 0, unknown: 0, notChecked: 0 };
}

function assertValidResult(result: RuleResult): void {
  if (
    result.status === 'CONDITIONAL' &&
    (!result.conditions || result.conditions.length === 0)
  ) {
    throw new Error(
      `Conditional rule ${result.ruleId} must include conditions`,
    );
  }

  if (result.policyMode === 'DISABLED' && result.status !== 'NOT_CHECKED') {
    throw new Error(`Disabled rule ${result.ruleId} must be NOT_CHECKED`);
  }
}

function calculateCoverage(
  results: readonly RuleResult[],
): CompatibilityCoverage {
  const required = emptyActiveBucket();
  const advisory = emptyActiveBucket();
  const disabled = { total: 0, notChecked: 0 };

  for (const result of results) {
    if (result.policyMode === 'DISABLED') {
      disabled.total += 1;
      disabled.notChecked += 1;
      continue;
    }

    const bucket = result.policyMode === 'REQUIRED' ? required : advisory;
    bucket.total += 1;
    if (result.status === 'NOT_CHECKED') {
      bucket.notChecked += 1;
    } else {
      bucket.evaluated += 1;
      if (result.status === 'UNKNOWN') bucket.unknown += 1;
    }
  }

  return { required, advisory, disabled };
}

function aggregateStatus(results: readonly RuleResult[]): CompatibilityStatus {
  return results.reduce<CompatibilityStatus>(
    (current, result) =>
      statusRank[result.status] > statusRank[current] ? result.status : current,
    'NOT_CHECKED',
  );
}

function aggregateDecision(
  results: readonly RuleResult[],
  coverage: CompatibilityCoverage,
): CompatibilityDecision {
  const required = results.filter((result) => result.policyMode === 'REQUIRED');

  if (required.some((result) => result.status === 'INCOMPATIBLE')) {
    return 'BLOCK';
  }
  if (
    required.some(
      (result) =>
        result.status === 'UNKNOWN' || result.status === 'REVIEW_REQUIRED',
    )
  ) {
    return 'REVIEW';
  }
  if (coverage.required.evaluated === 0) return 'NO_DECISION';
  if (required.some((result) => result.status === 'CONDITIONAL')) {
    return 'ALLOW_IF_CONDITIONS_MET';
  }

  const hasWarning = results.some(
    (result) =>
      result.status === 'WARNING' ||
      (result.policyMode === 'ADVISORY' &&
        result.status !== 'PASS' &&
        result.status !== 'NOT_CHECKED'),
  );
  return hasWarning ? 'ALLOW_WITH_WARNING' : 'ALLOW';
}

function groupIssues(results: readonly RuleResult[]): CompatibilityIssueGroups {
  return {
    blockingRuleIds: results
      .filter(
        (result) =>
          result.policyMode === 'REQUIRED' &&
          result.status === 'INCOMPATIBLE',
      )
      .map((result) => result.ruleId),
    reviewRuleIds: results
      .filter(
        (result) =>
          result.policyMode === 'REQUIRED' &&
          (result.status === 'UNKNOWN' ||
            result.status === 'REVIEW_REQUIRED'),
      )
      .map((result) => result.ruleId),
    advisoryRuleIds: results
      .filter(
        (result) =>
          result.status === 'WARNING' ||
          (result.policyMode === 'ADVISORY' &&
            result.status !== 'PASS' &&
            result.status !== 'NOT_CHECKED'),
      )
      .map((result) => result.ruleId),
  };
}

export function aggregateRuleResults(
  results: readonly RuleResult[],
): AggregatedCompatibilityResult {
  results.forEach(assertValidResult);
  const coverage = calculateCoverage(results);

  return {
    status: aggregateStatus(results),
    decision: aggregateDecision(results, coverage),
    coverage,
    issues: groupIssues(results),
    ruleResults: [...results],
  };
}
