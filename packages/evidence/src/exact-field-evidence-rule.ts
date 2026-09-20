import type {
  CanonicalBuild,
  EngineRule,
  InstallationContext,
  JsonValue,
  RuleEvaluation,
} from '@pcpartcheck/core';

import {
  classifyFieldEvidenceMatch,
  selectActiveFieldEvidence,
  type FieldEvidenceQuery,
  type FieldEvidenceRecordV4,
  type FieldEvidenceSnapshot,
} from './field-evidence.js';

interface EvaluateActiveExactEvidenceInput {
  readonly build: CanonicalBuild;
  readonly installationContext: InstallationContext;
  readonly evidenceSnapshot: JsonValue;
}

type GroupStatus = 'PASS' | 'CONDITIONAL' | 'REVIEW_REQUIRED' | 'INCOMPATIBLE';

interface ExactEvidenceGroup {
  readonly key: string;
  readonly records: readonly FieldEvidenceRecordV4[];
  readonly status: GroupStatus;
}

function notChecked(summary: string): RuleEvaluation {
  return { status: 'NOT_CHECKED', summary, reasons: [], evidenceIds: [] };
}

function isAbsentSnapshot(value: JsonValue): boolean {
  return typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0;
}

function groupKey(record: FieldEvidenceRecordV4): string {
  return JSON.stringify({
    issueType: record.issueType,
    requiredPartCategories: record.exactScope.requiredPartCategories,
    requiredContextFields: record.exactScope.requiredContextFields,
  });
}

function outcomeStatus(record: FieldEvidenceRecordV4): Exclude<
  GroupStatus,
  'REVIEW_REQUIRED'
> {
  switch (record.outcome) {
    case 'ASSEMBLY_FAILURE':
      return 'INCOMPATIBLE';
    case 'CONDITIONAL_SUCCESS':
      return 'CONDITIONAL';
    case 'ASSEMBLY_SUCCESS':
      return 'PASS';
  }
}

function buildGroups(
  records: readonly FieldEvidenceRecordV4[],
  branchConflictEvidenceIds: ReadonlySet<string>,
): readonly ExactEvidenceGroup[] {
  const grouped = new Map<string, FieldEvidenceRecordV4[]>();
  for (const record of records) {
    const key = groupKey(record);
    const group = grouped.get(key) ?? [];
    group.push(record);
    grouped.set(key, group);
  }

  return [...grouped.entries()]
    .map(([key, groupRecords]) => {
      const statuses = new Set(groupRecords.map(outcomeStatus));
      const hasBranchConflict = groupRecords.some(({ evidenceId }) =>
        branchConflictEvidenceIds.has(evidenceId));
      return {
        key,
        records: groupRecords,
        status: statuses.size > 1 || hasBranchConflict
          ? 'REVIEW_REQUIRED' as const
          : [...statuses][0]!,
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

function selectedGroups(
  groups: readonly ExactEvidenceGroup[],
): readonly ExactEvidenceGroup[] {
  for (const status of [
    'INCOMPATIBLE',
    'REVIEW_REQUIRED',
    'CONDITIONAL',
    'PASS',
  ] as const) {
    const selected = groups.filter((group) => group.status === status);
    if (selected.length > 0) return selected;
  }
  return [];
}

function evidenceIds(groups: readonly ExactEvidenceGroup[]): readonly string[] {
  return [...new Set(
    groups.flatMap(({ records }) => records.map(({ evidenceId }) => evidenceId)),
  )].sort((left, right) => left.localeCompare(right));
}

export function evaluateActiveExactEvidence(
  input: EvaluateActiveExactEvidenceInput,
): RuleEvaluation {
  if (isAbsentSnapshot(input.evidenceSnapshot)) {
    return notChecked('No Field Evidence snapshot was provided');
  }

  const selection = selectActiveFieldEvidence(
    input.evidenceSnapshot as unknown as FieldEvidenceSnapshot,
  );
  if (selection.active.length === 0) {
    return notChecked('No active approved Field Evidence is available');
  }

  const queryParts = input.build.parts.map(({ category, partId }) => ({
    category,
    partId,
  }));
  const exact = selection.active.filter((record) => {
    const query: FieldEvidenceQuery = {
      issueType: record.issueType,
      parts: queryParts,
      installationContext: input.installationContext,
    };
    return classifyFieldEvidenceMatch(record, query) === 'EXACT';
  });
  if (exact.length === 0) {
    return notChecked('No active Field Evidence exactly matches the selected build');
  }

  const exactIds = new Set(exact.map(({ evidenceId }) => evidenceId));
  const branchConflictEvidenceIds = new Set<string>();
  for (const conflict of selection.conflicts) {
    const matchingSuccessors = conflict.successorEvidenceIds.filter((evidenceId) =>
      exactIds.has(evidenceId));
    if (matchingSuccessors.length > 1) {
      matchingSuccessors.forEach((evidenceId) =>
        branchConflictEvidenceIds.add(evidenceId));
    }
  }

  const groups = buildGroups(exact, branchConflictEvidenceIds);
  const selected = selectedGroups(groups);
  const status = selected[0]?.status;
  const selectedEvidenceIds = evidenceIds(selected);

  if (status === 'INCOMPATIBLE') {
    return {
      status,
      summary: 'Approved exact Field Evidence records an assembly failure',
      reasons: selectedEvidenceIds.map(
        (evidenceId) => `Exact Field Evidence ${evidenceId} records assembly failure`,
      ),
      evidenceIds: selectedEvidenceIds,
    };
  }
  if (status === 'REVIEW_REQUIRED') {
    return {
      status,
      summary: 'Active exact Field Evidence has unresolved outcomes',
      reasons: ['Conflicting outcomes or supersession branches require review'],
      evidenceIds: selectedEvidenceIds,
    };
  }
  if (status === 'CONDITIONAL') {
    return {
      status,
      summary: 'Approved exact Field Evidence requires installation conditions',
      reasons: selectedEvidenceIds.map(
        (evidenceId) => `Exact Field Evidence ${evidenceId} is conditional`,
      ),
      conditions: selected.flatMap(({ records }) =>
        records.flatMap(({ conditions }) => conditions ?? [])),
      evidenceIds: selectedEvidenceIds,
    };
  }
  if (status === 'PASS') {
    return {
      status,
      summary: 'Approved exact Field Evidence records assembly success',
      reasons: [],
      evidenceIds: selectedEvidenceIds,
    };
  }
  return notChecked('No active Field Evidence exactly matches the selected build');
}

export const exactFieldEvidenceRule: EngineRule = {
  ruleId: 'exact-field-evidence',
  capabilityId: 'exact-field-evidence',
  evaluate: ({ build, installationContext, evidenceSnapshot }) =>
    evaluateActiveExactEvidence({ build, installationContext, evidenceSnapshot }),
};
