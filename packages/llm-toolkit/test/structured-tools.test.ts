import { describe, expect, test } from 'vitest';

import * as llm from '../src/index.js';

type Runner = (
  adapter: Readonly<Record<string, unknown>> | undefined,
  input: Readonly<Record<string, unknown>>,
) => Promise<Readonly<Record<string, unknown>>>;

function runner(name: string): Runner {
  const candidate = (llm as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeTypeOf('function');
  return candidate as Runner;
}

describe('StructuredIntentParser boundary', () => {
  test.each([
    'NEW_BUILD', 'UPGRADE', 'REPLACEMENT', 'COMPATIBILITY_CHECK',
  ] as const)('accepts the canonical %s use case', async (useCase) => {
    const partId = '11111111-1111-4111-8111-111111111111';
    const result = await runner('runStructuredIntentParser')(
      {
        parse: async () => ({
          schemaVersion: '1.0.0',
          useCase,
          existingParts: [{ partId, quantity: 1 }],
        }),
      },
      { text: '이 부품으로 확인해 주세요.', knownPartIds: [partId] },
    );

    expect(result).toMatchObject({
      status: 'GENERATED',
      intent: { useCase, existingParts: [{ partId }] },
    });
  });

  test('rejects an invented part identity', async () => {
    const result = await runner('runStructuredIntentParser')(
      {
        parse: async () => ({
          schemaVersion: '1.0.0',
          useCase: 'UPGRADE',
          requestedChanges: [{
            category: 'GPU',
            candidatePartId: '99999999-9999-4999-8999-999999999999',
          }],
        }),
      },
      {
        text: '그래픽카드를 바꾸고 싶습니다.',
        knownPartIds: ['11111111-1111-4111-8111-111111111111'],
      },
    );

    expect(result).toEqual({ status: 'INVALID_RESPONSE' });
  });
});

describe('EvidenceNoteSummarizer boundary', () => {
  test('preserves the original note and accepts observations without a verdict', async () => {
    const note = '전면 라디에이터를 위로 옮긴 뒤 장착했습니다.';
    const result = await runner('runEvidenceNoteSummarizer')(
      {
        summarize: async () => ({
          summary: '라디에이터 위치를 바꿔 장착한 사례',
          observedFacts: ['전면 라디에이터를 상단으로 이동함'],
        }),
      },
      { note },
    );

    expect(result).toEqual({
      status: 'GENERATED',
      originalNote: note,
      summary: '라디에이터 위치를 바꿔 장착한 사례',
      observedFacts: ['전면 라디에이터를 상단으로 이동함'],
    });
  });

  test.each(['status', 'decision', 'verdict', 'outcome'])(
    'rejects adapter output containing %s',
    async (forbiddenField) => {
      const result = await runner('runEvidenceNoteSummarizer')(
        {
          summarize: async () => ({
            summary: '요약',
            observedFacts: ['관찰'],
            [forbiddenField]: 'PASS',
          }),
        },
        { note: '원문' },
      );

      expect(result).toEqual({ status: 'INVALID_RESPONSE' });
    },
  );

  test('is unavailable when no optional provider is configured', async () => {
    await expect(
      runner('runEvidenceNoteSummarizer')(undefined, { note: '원문' }),
    ).resolves.toEqual({ status: 'UNAVAILABLE' });
  });
});
