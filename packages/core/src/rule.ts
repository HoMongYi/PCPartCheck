export type CompatibilityStatus =
  | 'PASS'
  | 'WARNING'
  | 'CONDITIONAL'
  | 'UNKNOWN'
  | 'REVIEW_REQUIRED'
  | 'INCOMPATIBLE'
  | 'NOT_CHECKED';

export interface RuleCondition {
  readonly code: string;
  readonly message: string;
}

export interface RuleEvaluation {
  readonly status: CompatibilityStatus;
  readonly summary: string;
  readonly reasons: readonly string[];
  readonly conditions?: readonly RuleCondition[];
  readonly evidenceIds: readonly string[];
}

export interface CompatibilityRule<TContext> {
  readonly ruleId: string;
  readonly capabilityId: string;
  evaluate(context: TContext): Promise<RuleEvaluation> | RuleEvaluation;
}
