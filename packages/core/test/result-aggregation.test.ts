import { expect, test } from 'vitest';

import * as core from '../src/index.js';

interface TestRuleResult {
  readonly ruleId: string;
  readonly capabilityId: string;
  readonly policyMode: 'REQUIRED' | 'ADVISORY' | 'DISABLED';
  readonly status:
    | 'PASS'
    | 'WARNING'
    | 'CONDITIONAL'
    | 'UNKNOWN'
    | 'REVIEW_REQUIRED'
    | 'INCOMPATIBLE'
    | 'NOT_CHECKED';
  readonly summary: string;
  readonly reasons: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly conditions?: readonly { readonly code: string; readonly message: string }[];
}

function aggregate(results: readonly TestRuleResult[]) {
  const candidate = (core as Readonly<Record<string, unknown>>)
    .aggregateRuleResults;
  expect(candidate).toBeTypeOf('function');
  return (
    candidate as (
      values: readonly TestRuleResult[],
    ) => Readonly<Record<string, unknown>>
  )(results);
}

function result(
  ruleId: string,
  policyMode: TestRuleResult['policyMode'],
  status: TestRuleResult['status'],
  conditions?: TestRuleResult['conditions'],
): TestRuleResult {
  return {
    ruleId,
    capabilityId: ruleId,
    policyMode,
    status,
    summary: `${ruleId}: ${status}`,
    reasons: [],
    evidenceIds: [],
    ...(conditions ? { conditions } : {}),
  };
}

test('required incompatibility blocks and is separated from advisory issues', () => {
  const aggregateResult = aggregate([
    result('socket', 'REQUIRED', 'INCOMPATIBLE'),
    result('rgb', 'ADVISORY', 'WARNING'),
  ]);

  expect(aggregateResult).toMatchObject({
    status: 'INCOMPATIBLE',
    decision: 'BLOCK',
    issues: {
      blockingRuleIds: ['socket'],
      reviewRuleIds: [],
      advisoryRuleIds: ['rgb'],
    },
  });
});

test('advisory incompatibility warns without blocking', () => {
  const aggregateResult = aggregate([
    result('socket', 'REQUIRED', 'PASS'),
    result('rgb', 'ADVISORY', 'INCOMPATIBLE'),
  ]);

  expect(aggregateResult).toMatchObject({
    status: 'INCOMPATIBLE',
    decision: 'ALLOW_WITH_WARNING',
    issues: {
      blockingRuleIds: [],
      advisoryRuleIds: ['rgb'],
    },
  });
});

test('required unknown requires review and remains unknown in coverage', () => {
  const aggregateResult = aggregate([
    result('socket', 'REQUIRED', 'UNKNOWN'),
    result('bios', 'DISABLED', 'NOT_CHECKED'),
  ]);

  expect(aggregateResult).toMatchObject({
    decision: 'REVIEW',
    coverage: {
      required: { total: 1, evaluated: 1, unknown: 1, notChecked: 0 },
      advisory: { total: 0, evaluated: 0, unknown: 0, notChecked: 0 },
      disabled: { total: 1, notChecked: 1 },
    },
    issues: { reviewRuleIds: ['socket'] },
  });
});

test('required conditional result returns conditions-met decision', () => {
  const aggregateResult = aggregate([
    result('gpu-clearance', 'REQUIRED', 'CONDITIONAL', [
      { code: 'MEASURE_CLEARANCE', message: '실측 여유 공간을 확인하세요.' },
    ]),
  ]);

  expect(aggregateResult).toMatchObject({
    status: 'CONDITIONAL',
    decision: 'ALLOW_IF_CONDITIONS_MET',
  });
});

test('no evaluated required rule produces no decision', () => {
  const aggregateResult = aggregate([
    result('socket', 'REQUIRED', 'NOT_CHECKED'),
    result('qvl', 'DISABLED', 'NOT_CHECKED'),
  ]);

  expect(aggregateResult).toMatchObject({
    status: 'NOT_CHECKED',
    decision: 'NO_DECISION',
    coverage: {
      required: { total: 1, evaluated: 0, unknown: 0, notChecked: 1 },
    },
  });
});

test('conditional results must include at least one condition', () => {
  expect(() =>
    aggregate([result('gpu-clearance', 'REQUIRED', 'CONDITIONAL')]),
  ).toThrow('Conditional rule gpu-clearance must include conditions');
});

test('disabled capabilities cannot report an evaluated result', () => {
  expect(() => aggregate([result('qvl', 'DISABLED', 'PASS')])).toThrow(
    'Disabled rule qvl must be NOT_CHECKED',
  );
});
