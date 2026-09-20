import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { describe, expect, test } from 'vitest';

import * as contracts from '../src/index.js';

function schema(name: string): TSchema {
  const candidate = (contracts as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as TSchema;
}

const emptyEvidenceSnapshot = {
  fieldEvidenceSchemaVersion: '4.0.0',
  evidencePolicyVersion: '1.0.0',
  records: [],
} as const;

const knowledgeSnapshot = {
  schemaVersion: '1.0.0',
  snapshotId: 'synthetic-knowledge-1',
  provider: {
    providerId: 'synthetic-manufacturer',
    providerVersion: '1.0.0',
    dataRevision: 'fixture-1',
  },
  collectedAt: '2026-09-20T00:00:00.000Z',
  sources: [{
    sourceId: 'source-1',
    sourceUri: 'https://example.invalid/knowledge/source-1',
    capturedAt: '2026-09-20T00:00:00.000Z',
    contentHash: 'sha256:fixture-source-1',
    evidenceIds: [],
  }],
  relations: [],
} as const;

const request = {
  build: { schemaVersion: '3.1.0', parts: [] },
  intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
  installationContext: { schemaVersion: '2.1.0' },
  policyProfile: {
    profileId: 'synthetic',
    policyVersion: '2.0.0',
    capabilities: [],
  },
  evidenceSnapshot: emptyEvidenceSnapshot,
} as const;

describe('v0.2 compatibility request contract', () => {
  test('accepts omitted knowledge and a provider-neutral Knowledge Snapshot 1.0', () => {
    const requestSchema = schema('CompatibilityCheckRequestSchema');

    expect(Value.Check(requestSchema, request)).toBe(true);
    expect(Value.Check(requestSchema, {
      ...request,
      knowledgeSnapshots: [knowledgeSnapshot],
    })).toBe(true);
  });

  test('rejects provider-private and business extension keys', () => {
    const requestSchema = schema('CompatibilityCheckRequestSchema');

    expect(Value.Check(requestSchema, {
      ...request,
      knowledgeSnapshots: [{
        ...knowledgeSnapshot,
        provider: {
          ...knowledgeSnapshot.provider,
          providerPrivateKey: 'forbidden-provider-key',
        },
      }],
    })).toBe(false);
    expect(Value.Check(requestSchema, {
      ...request,
      internalWorkflowState: 'forbidden-business-field',
    })).toBe(false);
  });

  test('requires the versioned Field Evidence v4 envelope', () => {
    const requestSchema = schema('CompatibilityCheckRequestSchema');

    expect(Value.Check(requestSchema, {
      ...request,
      evidenceSnapshot: { evidenceVersion: '1.0.0', evidenceIds: [] },
    })).toBe(false);
  });
});

describe('Result Snapshot 3.0 public response contract', () => {
  test('publishes normalized knowledge and independent contract versions', () => {
    const responseSchema = schema('ResultSnapshotResponseSchema');
    const response = {
      snapshotFormatVersion: '3.0.0',
      checkedAt: '2026-09-20T00:00:00.000Z',
      engineVersion: '0.1.0',
      ruleSetVersion: '0.1.0',
      policyVersion: '2.0.0',
      canonicalSchemaVersion: '3.1.0',
      installationContextSchemaVersion: '2.1.0',
      knowledgeSnapshotSchemaVersion: '1.0.0',
      evidencePolicyVersion: '1.0.0',
      identityMapperVersion: '1.1.0',
      providerVersions: [{
        providerId: 'synthetic-manufacturer',
        providerVersion: '1.0.0',
      }],
      inputSnapshot: {
        build: request.build,
        intent: request.intent,
        installationContext: request.installationContext,
        policyProfile: request.policyProfile,
        knowledgeSnapshots: [knowledgeSnapshot],
      },
      evidenceSnapshot: emptyEvidenceSnapshot,
      resultSnapshot: {
        status: 'NOT_CHECKED',
        decision: 'NO_DECISION',
        coverage: {
          required: { total: 0, evaluated: 0, unknown: 0, notChecked: 0 },
          advisory: { total: 0, evaluated: 0, unknown: 0, notChecked: 0 },
          disabled: { total: 0, notChecked: 0 },
        },
        issues: {
          blockingRuleIds: [],
          reviewRuleIds: [],
          advisoryRuleIds: [],
        },
        ruleResults: [{
          ruleId: 'cpu-support',
          capabilityId: 'cpu-support',
          policyMode: 'DISABLED',
          status: 'NOT_CHECKED',
          summary: 'Disabled',
          reasons: [],
          evidenceIds: [],
          knowledgeRelationIds: ['support-1'],
        }],
      },
    };

    expect(Value.Check(responseSchema, response)).toBe(true);
  });
});
