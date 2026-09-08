import type { InstallationContext } from '@pcpartcheck/core';
import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { describe, expect, test } from 'vitest';

import * as evidence from '../src/index.js';

const installationContext: InstallationContext = { schemaVersion: '2.0.0' };

const draftInput = {
  evidenceId: 'field-revision-2',
  visibility: 'STAFF_ONLY',
  redaction: 'ANONYMIZED',
  outcome: 'ASSEMBLY_FAILURE',
  issueType: 'PHYSICAL_CLEARANCE',
  parts: [
    { category: 'GPU', partId: '11111111-1111-4111-8111-111111111111' },
  ],
  installationContext,
  reportedAt: '2026-09-09T00:00:00.000Z',
  supersedesEvidenceId: 'field-revision-1',
} as const;

function exportedFunction<T>(name: string): T {
  const candidate = (evidence as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as T;
}

type CreateDraft = (
  input: typeof draftInput,
  audit: { readonly principalId: string; readonly at: string },
) => Readonly<Record<string, unknown>>;
type PatchDraft = (
  record: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>,
  audit: { readonly principalId: string; readonly at: string },
) => Readonly<Record<string, unknown>>;
type Moderate = (
  record: Readonly<Record<string, unknown>>,
  moderation: Readonly<Record<string, unknown>>,
) => Readonly<Record<string, unknown>>;

describe('Field Evidence 3.0 outcome contract', () => {
  const schema = () => exportedFunction<TSchema>('FieldEvidenceRecordSchema');
  const approvedBase = {
    schemaVersion: '3.0.0',
    evidenceId: 'field-1',
    status: 'APPROVED',
    visibility: 'PUBLIC',
    redaction: 'NONE',
    issueType: 'PHYSICAL_CLEARANCE',
    parts: draftInput.parts,
    installationContext,
    reportedAt: '2026-09-09T00:00:00.000Z',
    createdByPrincipalId: 'writer-1',
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T01:00:00.000Z',
    moderatedByPrincipalId: 'admin-1',
    moderatedAt: '2026-09-09T01:00:00.000Z',
  } as const;

  test('requires at least one condition for CONDITIONAL_SUCCESS', () => {
    expect(Value.Check(schema(), {
      ...approvedBase,
      outcome: 'CONDITIONAL_SUCCESS',
      conditions: [{ code: 'MOVE_RADIATOR', message: '라디에이터 위치를 바꿉니다.' }],
    })).toBe(true);
    expect(Value.Check(schema(), {
      ...approvedBase,
      outcome: 'CONDITIONAL_SUCCESS',
    })).toBe(false);
  });

  test('does not use ASSEMBLY_FAILURE plus conditions as a conditional result', () => {
    expect(Value.Check(schema(), {
      ...approvedBase,
      outcome: 'ASSEMBLY_FAILURE',
      conditions: [{ code: 'MOVE_RADIATOR', message: '라디에이터 위치를 바꿉니다.' }],
    })).toBe(false);
  });
});

describe('Field Evidence moderation state machine', () => {
  const createDraft = () => exportedFunction<CreateDraft>('createDraftFieldEvidence');
  const patchDraft = () => exportedFunction<PatchDraft>('patchDraftFieldEvidence');
  const moderate = () => exportedFunction<Moderate>('moderateFieldEvidence');

  test('creates an auditable draft revision and lets a writer edit only the draft', () => {
    const draft = createDraft()(draftInput, {
      principalId: 'writer-1',
      at: '2026-09-09T00:10:00.000Z',
    });
    const updated = patchDraft()(draft, { redaction: 'NONE' }, {
      principalId: 'writer-2',
      at: '2026-09-09T00:20:00.000Z',
    });

    expect(draft).toMatchObject({
      schemaVersion: '3.0.0',
      status: 'DRAFT',
      createdByPrincipalId: 'writer-1',
      createdAt: '2026-09-09T00:10:00.000Z',
      updatedAt: '2026-09-09T00:10:00.000Z',
      supersedesEvidenceId: 'field-revision-1',
    });
    expect(updated).toMatchObject({
      redaction: 'NONE',
      createdByPrincipalId: 'writer-1',
      createdAt: '2026-09-09T00:10:00.000Z',
      updatedAt: '2026-09-09T00:20:00.000Z',
    });
  });

  test.each(['APPROVE', 'REJECT'] as const)(
    'records moderator identity and time for %s',
    (action) => {
      const draft = createDraft()(draftInput, {
        principalId: 'writer-1',
        at: '2026-09-09T00:10:00.000Z',
      });
      const result = moderate()(draft, {
        action,
        principalId: 'admin-1',
        at: '2026-09-09T01:00:00.000Z',
        reason: action === 'REJECT' ? '사진 식별 불가' : '검토 완료',
      });

      expect(result).toMatchObject({
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        moderatedByPrincipalId: 'admin-1',
        moderatedAt: '2026-09-09T01:00:00.000Z',
        moderationReason: action === 'REJECT' ? '사진 식별 불가' : '검토 완료',
        updatedAt: '2026-09-09T01:00:00.000Z',
      });
    },
  );

  test.each(['APPROVE', 'REJECT'] as const)(
    'keeps an %s result immutable and rejects every later patch',
    (action) => {
      const draft = createDraft()(draftInput, {
        principalId: 'writer-1',
        at: '2026-09-09T00:10:00.000Z',
      });
      const finalRecord = moderate()(draft, {
        action,
        principalId: 'admin-1',
        at: '2026-09-09T01:00:00.000Z',
      });

      expect(() => patchDraft()(finalRecord, {
        outcome: 'ASSEMBLY_SUCCESS',
        parts: [],
        installationContext: { schemaVersion: '2.0.0' },
      }, {
        principalId: 'writer-2',
        at: '2026-09-09T02:00:00.000Z',
      })).toThrow('Only DRAFT field evidence can be changed');
    },
  );

  test('rejects repeat approval and direct rejected-to-approved promotion', () => {
    const draft = createDraft()(draftInput, {
      principalId: 'writer-1',
      at: '2026-09-09T00:10:00.000Z',
    });
    const approved = moderate()(draft, {
      action: 'APPROVE', principalId: 'admin-1', at: '2026-09-09T01:00:00.000Z',
    });
    const rejected = moderate()(draft, {
      action: 'REJECT', principalId: 'admin-1', at: '2026-09-09T01:00:00.000Z',
    });

    expect(() => moderate()(approved, {
      action: 'APPROVE', principalId: 'admin-2', at: '2026-09-09T02:00:00.000Z',
    })).toThrow('Only DRAFT field evidence can be moderated');
    expect(() => moderate()(rejected, {
      action: 'APPROVE', principalId: 'admin-2', at: '2026-09-09T02:00:00.000Z',
    })).toThrow('Only DRAFT field evidence can be moderated');
  });
});
