import {
  BuildIntentSchema,
  type BuildIntent,
  type PartId,
} from '@pcpartcheck/core';
import { Value } from '@sinclair/typebox/value';

export interface StructuredIntentParserInput {
  readonly text: string;
  readonly knownPartIds: readonly PartId[];
}

export interface StructuredIntentParser {
  parse(input: StructuredIntentParserInput): Promise<unknown>;
}

export interface EvidenceNoteSummarizerInput {
  readonly note: string;
}

export interface EvidenceNoteSummarizer {
  summarize(input: EvidenceNoteSummarizerInput): Promise<unknown>;
}

export type OptionalLlmToolResult<T> =
  | { readonly status: 'UNAVAILABLE' }
  | { readonly status: 'INVALID_RESPONSE' }
  | ({ readonly status: 'GENERATED' } & T);

function object(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}

function referencedPartIds(intent: BuildIntent): readonly PartId[] {
  return [
    ...(intent.existingParts?.map(({ partId }) => partId) ?? []),
    ...(intent.preservedParts?.map(({ partId }) => partId) ?? []),
    ...(intent.requestedChanges?.flatMap((change) => [
      ...(change.replacedPartId ? [change.replacedPartId] : []),
      ...(change.candidatePartId ? [change.candidatePartId] : []),
    ]) ?? []),
  ];
}

export async function runStructuredIntentParser(
  parser: StructuredIntentParser | undefined,
  input: StructuredIntentParserInput,
): Promise<OptionalLlmToolResult<{ readonly intent: BuildIntent }>> {
  if (!parser) return { status: 'UNAVAILABLE' };
  const response = await parser.parse({
    text: input.text,
    knownPartIds: [...input.knownPartIds],
  });
  if (!Value.Check(BuildIntentSchema, response)) {
    return { status: 'INVALID_RESPONSE' };
  }
  const intent = response as BuildIntent;
  const knownPartIds = new Set<string>(input.knownPartIds);
  if (referencedPartIds(intent).some((partId) => !knownPartIds.has(partId))) {
    return { status: 'INVALID_RESPONSE' };
  }
  return { status: 'GENERATED', intent };
}

export async function runEvidenceNoteSummarizer(
  summarizer: EvidenceNoteSummarizer | undefined,
  input: EvidenceNoteSummarizerInput,
): Promise<OptionalLlmToolResult<{
  readonly originalNote: string;
  readonly summary: string;
  readonly observedFacts: readonly string[];
}>> {
  if (!summarizer) return { status: 'UNAVAILABLE' };
  const response = object(await summarizer.summarize({ note: input.note }));
  if (
    !response ||
    Object.keys(response).some(
      (key) => key !== 'summary' && key !== 'observedFacts',
    ) ||
    typeof response.summary !== 'string' ||
    !response.summary.trim() ||
    !Array.isArray(response.observedFacts) ||
    response.observedFacts.some(
      (fact) => typeof fact !== 'string' || !fact.trim(),
    )
  ) {
    return { status: 'INVALID_RESPONSE' };
  }
  return {
    status: 'GENERATED',
    originalNote: input.note,
    summary: response.summary.trim(),
    observedFacts: response.observedFacts.map((fact) => (fact as string).trim()),
  };
}
