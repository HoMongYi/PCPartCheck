import type { AggregatedCompatibilityResult } from '@pcpartcheck/core';
import { describe, expect, test } from 'vitest';

import * as llm from '../src/index.js';

interface TestAdapter {
  explainCompatibility(input: Readonly<Record<string, unknown>>): Promise<unknown>;
  rankIdentityCandidates(input: Readonly<Record<string, unknown>>): Promise<unknown>;
}

interface TestToolkit {
  explainCompatibility(input: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>>;
  rankIdentityCandidates(input: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>>;
}

type ToolkitFactory = (adapter?: TestAdapter) => TestToolkit;

function createToolkit(adapter?: TestAdapter): TestToolkit {
  const candidate = (llm as Readonly<Record<string, unknown>>).createLlmToolkit;
  expect(candidate, 'createLlmToolkit must be exported').toBeTypeOf('function');
  return (candidate as ToolkitFactory)(adapter);
}

function compatibilityResult(
  status: 'INCOMPATIBLE' | 'UNKNOWN',
  decision: 'BLOCK' | 'REVIEW',
): AggregatedCompatibilityResult {
  return {
    status,
    decision,
    coverage: {
      required: { total: 1, evaluated: 1, unknown: status === 'UNKNOWN' ? 1 : 0, notChecked: 0 },
      advisory: { total: 0, evaluated: 0, unknown: 0, notChecked: 0 },
      disabled: { total: 0, notChecked: 0 },
    },
    issues: {
      blockingRuleIds: status === 'INCOMPATIBLE' ? ['socket'] : [],
      reviewRuleIds: status === 'UNKNOWN' ? ['socket'] : [],
      advisoryRuleIds: [],
    },
    ruleResults: [
      {
        ruleId: 'socket',
        capabilityId: 'socket',
        policyMode: 'REQUIRED',
        status,
        summary: 'Deterministic result',
        reasons: [],
        evidenceIds: [],
      },
    ],
  };
}

describe('optional LLM boundary', () => {
  test('returns unavailable without an adapter', async () => {
    await expect(
      createToolkit().explainCompatibility({
        result: compatibilityResult('UNKNOWN', 'REVIEW'),
        audience: 'CUSTOMER',
      }),
    ).resolves.toEqual({ status: 'UNAVAILABLE' });
  });

  test.each([
    ['INCOMPATIBLE', 'BLOCK'],
    ['UNKNOWN', 'REVIEW'],
  ] as const)(
    'does not let an adapter replace %s with PASS',
    async (status, decision) => {
      const original = compatibilityResult(status, decision);
      const adapter: TestAdapter = {
        explainCompatibility: async (input) => {
          expect(input).not.toHaveProperty('result');
          expect(input).not.toHaveProperty('status');
          expect(input).not.toHaveProperty('decision');
          return {
            sections: [{ ruleId: 'socket', text: '소켓 규칙을 확인하세요.' }],
          };
        },
        rankIdentityCandidates: async () => ({ candidatePartIds: [] }),
      };

      const response = await createToolkit(adapter).explainCompatibility({
        result: original,
        audience: 'CUSTOMER',
      });

      expect(response).toMatchObject({
        status: 'GENERATED',
        sections: [{ ruleId: 'socket', text: '소켓 규칙을 확인하세요.' }],
        presentation: {
          title: status === 'INCOMPATIBLE'
            ? '호환되지 않는 필수 조건이 있습니다'
            : '확인이 필요한 정보가 있습니다',
          status,
          decision,
        },
        deterministicResult: original,
      });
      expect(original).toEqual(compatibilityResult(status, decision));
      expect(response).not.toHaveProperty('decision');
    },
  );

  test('returns identity ordering as review-only and removes unknown candidates', async () => {
    const adapter: TestAdapter = {
      explainCompatibility: async () => ({
        sections: [{ ruleId: 'socket', text: '소켓 규칙 설명' }],
      }),
      rankIdentityCandidates: async () => ({
        candidatePartIds: ['unknown', 'part-b', 'part-a', 'part-b'],
      }),
    };

    const response = await createToolkit(adapter).rankIdentityCandidates({
      sourceRecord: { rawName: 'Example CPU' },
      candidatePartIds: ['part-a', 'part-b'],
    });

    expect(response).toEqual({
      status: 'REVIEW_REQUIRED',
      candidatePartIds: ['part-b', 'part-a'],
    });
  });

  test('rejects malformed adapter output instead of inventing an explanation', async () => {
    const adapter: TestAdapter = {
      explainCompatibility: async () => ({ text: '' }),
      rankIdentityCandidates: async () => ({ candidatePartIds: 'part-a' }),
    };
    const toolkit = createToolkit(adapter);

    await expect(
      toolkit.explainCompatibility({
        result: compatibilityResult('UNKNOWN', 'REVIEW'),
        audience: 'STAFF',
      }),
    ).resolves.toEqual({ status: 'INVALID_RESPONSE' });
    await expect(
      toolkit.rankIdentityCandidates({
        sourceRecord: {},
        candidatePartIds: ['part-a'],
      }),
    ).resolves.toEqual({ status: 'INVALID_RESPONSE' });
  });

  test('rejects explanation sections for rule ids absent from the deterministic result', async () => {
    const adapter: TestAdapter = {
      explainCompatibility: async () => ({
        sections: [{ ruleId: 'invented-rule', text: '임의 설명' }],
      }),
      rankIdentityCandidates: async () => ({ candidatePartIds: [] }),
    };

    await expect(
      createToolkit(adapter).explainCompatibility({
        result: compatibilityResult('INCOMPATIBLE', 'BLOCK'),
        audience: 'CUSTOMER',
      }),
    ).resolves.toEqual({ status: 'INVALID_RESPONSE' });
  });

  test('never promotes an attempted overall compatibility verdict to the final title', async () => {
    const adapter: TestAdapter = {
      explainCompatibility: async () => ({
        sections: [{ ruleId: 'socket', text: '모두 호환됩니다.' }],
      }),
      rankIdentityCandidates: async () => ({ candidatePartIds: [] }),
    };

    const response = await createToolkit(adapter).explainCompatibility({
      result: compatibilityResult('INCOMPATIBLE', 'BLOCK'),
      audience: 'CUSTOMER',
    });

    expect(response).toMatchObject({
      status: 'GENERATED',
      presentation: {
        title: '호환되지 않는 필수 조건이 있습니다',
        status: 'INCOMPATIBLE',
        decision: 'BLOCK',
      },
    });
    expect(response).not.toHaveProperty('text');
    expect(response).not.toHaveProperty('verdict');
  });

  test('rejects top-level verdict fields from the adapter', async () => {
    const adapter: TestAdapter = {
      explainCompatibility: async () => ({
        verdict: 'ALLOW',
        sections: [{ ruleId: 'socket', text: '소켓 규칙 설명' }],
      }),
      rankIdentityCandidates: async () => ({ candidatePartIds: [] }),
    };

    await expect(
      createToolkit(adapter).explainCompatibility({
        result: compatibilityResult('INCOMPATIBLE', 'BLOCK'),
        audience: 'CUSTOMER',
      }),
    ).resolves.toEqual({ status: 'INVALID_RESPONSE' });
  });
});
