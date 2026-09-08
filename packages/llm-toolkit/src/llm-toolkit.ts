import type {
  AggregatedCompatibilityResult,
  JsonValue,
  PartId,
} from '@pcpartcheck/core';

export type LlmAudience = 'CUSTOMER' | 'STAFF';

export interface LlmExplanationRequest {
  readonly result: AggregatedCompatibilityResult;
  readonly audience: LlmAudience;
}

export interface LlmRuleExplanationInput {
  readonly audience: LlmAudience;
  readonly rules: readonly {
    readonly ruleId: string;
    readonly summary: string;
    readonly reasons: readonly string[];
    readonly evidenceIds: readonly string[];
  }[];
}

export interface LlmIdentityRankingRequest {
  readonly sourceRecord: JsonValue;
  readonly candidatePartIds: readonly PartId[];
}

export interface LlmAdapter {
  explainCompatibility(input: LlmRuleExplanationInput): Promise<unknown>;
  rankIdentityCandidates(input: LlmIdentityRankingRequest): Promise<unknown>;
}

export type LlmUnavailableResult = { readonly status: 'UNAVAILABLE' };
export type LlmInvalidResponse = { readonly status: 'INVALID_RESPONSE' };

export interface LlmGeneratedExplanation {
  readonly status: 'GENERATED';
  readonly sections: readonly {
    readonly ruleId: string;
    readonly text: string;
  }[];
  readonly audience: LlmAudience;
  readonly presentation: {
    readonly title: string;
    readonly status: AggregatedCompatibilityResult['status'];
    readonly decision: AggregatedCompatibilityResult['decision'];
    readonly blockingRuleIds: readonly string[];
    readonly reviewRuleIds: readonly string[];
    readonly advisoryRuleIds: readonly string[];
  };
  readonly deterministicResult: AggregatedCompatibilityResult;
}

export interface LlmIdentityReview {
  readonly status: 'REVIEW_REQUIRED';
  readonly candidatePartIds: readonly PartId[];
}

export interface LlmToolkit {
  explainCompatibility(
    input: LlmExplanationRequest,
  ): Promise<LlmUnavailableResult | LlmInvalidResponse | LlmGeneratedExplanation>;
  rankIdentityCandidates(
    input: LlmIdentityRankingRequest,
  ): Promise<LlmUnavailableResult | LlmInvalidResponse | LlmIdentityReview>;
}

function object(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function deterministicTitle(
  decision: AggregatedCompatibilityResult['decision'],
): string {
  switch (decision) {
    case 'BLOCK':
      return '호환되지 않는 필수 조건이 있습니다';
    case 'REVIEW':
      return '확인이 필요한 정보가 있습니다';
    case 'ALLOW_WITH_WARNING':
      return '주의 사항을 확인하면 진행할 수 있습니다';
    case 'ALLOW_IF_CONDITIONS_MET':
      return '설치 조건을 충족하면 진행할 수 있습니다';
    case 'ALLOW':
      return '확인한 범위에서는 진행할 수 있습니다';
    case 'NO_DECISION':
      return '판정할 규칙이 없습니다';
  }
}

function explanationSections(
  response: Readonly<Record<string, unknown>>,
  allowedRuleIds: ReadonlySet<string>,
): readonly { readonly ruleId: string; readonly text: string }[] | undefined {
  if (
    ['status', 'decision', 'verdict', 'overall', 'text'].some(
      (key) => key in response,
    ) ||
    !Array.isArray(response.sections)
  ) {
    return undefined;
  }

  const seen = new Set<string>();
  const sections = [];
  for (const value of response.sections) {
    const section = object(value);
    if (
      !section ||
      typeof section.ruleId !== 'string' ||
      !allowedRuleIds.has(section.ruleId) ||
      seen.has(section.ruleId) ||
      typeof section.text !== 'string' ||
      !section.text.trim()
    ) {
      return undefined;
    }
    seen.add(section.ruleId);
    sections.push({ ruleId: section.ruleId, text: section.text.trim() });
  }
  return sections.length > 0 ? sections : undefined;
}

export function createLlmToolkit(adapter?: LlmAdapter): LlmToolkit {
  return {
    explainCompatibility: async (input) => {
      if (!adapter) return { status: 'UNAVAILABLE' };
      const deterministicResult = structuredClone(input.result);
      const response = object(
        await adapter.explainCompatibility({
          audience: input.audience,
          rules: input.result.ruleResults.map((rule) => ({
            ruleId: rule.ruleId,
            summary: rule.summary,
            reasons: [...rule.reasons],
            evidenceIds: [...rule.evidenceIds],
          })),
        }),
      );
      const sections = response
        ? explanationSections(
            response,
            new Set(input.result.ruleResults.map((rule) => rule.ruleId)),
          )
        : undefined;
      if (!sections) {
        return { status: 'INVALID_RESPONSE' };
      }
      return {
        status: 'GENERATED',
        sections,
        audience: input.audience,
        presentation: {
          title: deterministicTitle(deterministicResult.decision),
          status: deterministicResult.status,
          decision: deterministicResult.decision,
          blockingRuleIds: [...deterministicResult.issues.blockingRuleIds],
          reviewRuleIds: [...deterministicResult.issues.reviewRuleIds],
          advisoryRuleIds: [...deterministicResult.issues.advisoryRuleIds],
        },
        deterministicResult,
      };
    },
    rankIdentityCandidates: async (input) => {
      if (!adapter) return { status: 'UNAVAILABLE' };
      const response = object(
        await adapter.rankIdentityCandidates(structuredClone(input)),
      );
      if (!Array.isArray(response?.candidatePartIds)) {
        return { status: 'INVALID_RESPONSE' };
      }
      const allowed = new Set<string>(input.candidatePartIds);
      const seen = new Set<string>();
      const candidatePartIds = response.candidatePartIds.flatMap((value) => {
        if (
          typeof value !== 'string' ||
          !allowed.has(value) ||
          seen.has(value)
        ) {
          return [];
        }
        seen.add(value);
        return [value as PartId];
      });
      return { status: 'REVIEW_REQUIRED', candidatePartIds };
    },
  };
}
