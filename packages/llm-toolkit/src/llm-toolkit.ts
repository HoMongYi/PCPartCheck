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

export interface LlmIdentityRankingRequest {
  readonly sourceRecord: JsonValue;
  readonly candidatePartIds: readonly PartId[];
}

export interface LlmAdapter {
  explainCompatibility(input: LlmExplanationRequest): Promise<unknown>;
  rankIdentityCandidates(input: LlmIdentityRankingRequest): Promise<unknown>;
}

export type LlmUnavailableResult = { readonly status: 'UNAVAILABLE' };
export type LlmInvalidResponse = { readonly status: 'INVALID_RESPONSE' };

export interface LlmGeneratedExplanation {
  readonly status: 'GENERATED';
  readonly text: string;
  readonly audience: LlmAudience;
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

export function createLlmToolkit(adapter?: LlmAdapter): LlmToolkit {
  return {
    explainCompatibility: async (input) => {
      if (!adapter) return { status: 'UNAVAILABLE' };
      const deterministicResult = structuredClone(input.result);
      const response = object(
        await adapter.explainCompatibility(structuredClone(input)),
      );
      const text = response?.text;
      if (typeof text !== 'string' || !text.trim()) {
        return { status: 'INVALID_RESPONSE' };
      }
      return {
        status: 'GENERATED',
        text,
        audience: input.audience,
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
