import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  CanonicalPart,
  InstallationContext,
  ResultSnapshot,
} from '@pcpartcheck/core';
import type { FieldEvidenceRecord, RawFieldEvidence } from '@pcpartcheck/evidence';
import type { ExternalMapping } from '@pcpartcheck/identity';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, test } from 'vitest';

import * as storage from '../../packages/storage-sqlite/src/index.js';

interface TestStore {
  close(): void;
  putCanonicalPart(part: CanonicalPart): void;
  getCanonicalPart(partId: string): CanonicalPart | undefined;
  putExternalMapping(mapping: ExternalMapping): void;
  findExternalMapping(source: string, externalId: string): ExternalMapping | undefined;
  putRawEvidence(evidence: RawFieldEvidence): void;
  getRawEvidence(evidenceId: string): RawFieldEvidence | undefined;
  putFieldEvidence(evidence: FieldEvidenceRecord): void;
  getFieldEvidence(evidenceId: string): FieldEvidenceRecord | undefined;
  putResultSnapshot(snapshotId: string, snapshot: ResultSnapshot): void;
  getResultSnapshot(snapshotId: string): ResultSnapshot | undefined;
}

type OpenStore = (options: { readonly filename: string }) => TestStore;

const cleanupDirectories: string[] = [];

afterEach(async () => {
  for (const directory of cleanupDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function openStore(): Promise<{ directory: string; filename: string; store: TestStore }> {
  const directory = await mkdtemp(join(tmpdir(), 'pcpartcheck-sqlite-'));
  cleanupDirectories.push(directory);
  const filename = join(directory, 'test.sqlite');
  const candidate = (storage as Readonly<Record<string, unknown>>).openSqliteStore;
  expect(candidate, 'openSqliteStore must be exported').toBeTypeOf('function');
  return {
    directory,
    filename,
    store: (candidate as OpenStore)({ filename }),
  };
}

const cpu: CanonicalPart = {
  schemaVersion: '1.1.0',
  partId: '11111111-1111-4111-8111-111111111111',
  category: 'CPU',
  manufacturer: 'Example',
  model: 'Eight Core',
  status: 'ACTIVE',
  spec: { socket: 'AM5', peakPowerW: 120 },
};

const mapping: ExternalMapping = {
  source: 'fixture',
  externalId: 'cpu-1',
  partId: cpu.partId,
  rawName: 'Example Eight Core',
  matchMethod: 'GLOBAL_IDENTIFIER',
  confidence: 'HIGH',
  status: 'CONFIRMED',
  matchedAt: '2026-09-08T00:00:00.000Z',
  mapperVersion: '1.0.0',
};

const installationContext: InstallationContext = {
  schemaVersion: '1.0.0',
  radiators: [],
  hddCages: [],
  gpuOrientation: 'HORIZONTAL',
  occupiedPcieSlotIds: [],
  pciePower: {
    independentCableCount: 0,
    native12VhpwrCableCount: 0,
    native12V2x6CableCount: 0,
    adapterUsed: false,
  },
};

describe('SQLite migrations', () => {
  test('creates every persistence table in a real SQLite file', async () => {
    const { filename, store } = await openStore();
    store.close();

    const database = new Database(filename, { readonly: true });
    const tables = database
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => (row as { name: string }).name);
    database.close();

    expect(tables).toEqual(
      expect.arrayContaining([
        '__drizzle_migrations',
        'canonical_parts',
        'external_mappings',
        'field_evidence',
        'raw_evidence',
        'result_snapshots',
      ]),
    );
  });
});

describe('SQLite repositories', () => {
  test('upserts and reads a canonical part', async () => {
    const { store } = await openStore();
    store.putCanonicalPart(cpu);
    store.putCanonicalPart({ ...cpu, model: 'Eight Core Refresh' });

    expect(store.getCanonicalPart(cpu.partId)).toEqual({
      ...cpu,
      model: 'Eight Core Refresh',
    });
    store.close();
  });

  test('keeps an external mapping on its original canonical part', async () => {
    const { store } = await openStore();
    store.putCanonicalPart(cpu);
    store.putExternalMapping(mapping);

    expect(store.findExternalMapping('fixture', 'cpu-1')).toEqual(mapping);
    expect(() =>
      store.putExternalMapping({
        ...mapping,
        partId: '22222222-2222-4222-8222-222222222222',
      }),
    ).toThrow('External mapping cannot change canonical part');
    store.close();
  });

  test('round-trips raw and exact field evidence without losing source values', async () => {
    const { store } = await openStore();
    const rawEvidence: RawFieldEvidence = {
      evidenceId: 'raw-length',
      role: 'TECHNICAL_SPEC',
      source: { providerId: 'fixture', providerVersion: '1.0.0' },
      capturedAt: '2026-09-08T00:00:00.000Z',
      fieldPath: 'spec.lengthMm',
      rawValue: 16,
      rawUnit: 'cm',
    };
    const fieldEvidence: FieldEvidenceRecord = {
      schemaVersion: '1.0.0',
      evidenceId: 'field-clearance',
      status: 'APPROVED',
      visibility: 'PUBLIC',
      outcome: 'ASSEMBLY_FAILURE',
      issueType: 'PHYSICAL_CLEARANCE',
      parts: [{ category: 'CPU', partId: cpu.partId }],
      installationContext,
      measurements: [
        {
          fieldPath: 'spec.lengthMm',
          value: 160,
          unit: 'mm',
          rawEvidenceId: 'raw-length',
        },
      ],
      reportedAt: '2026-09-08T00:00:00.000Z',
    };

    store.putRawEvidence(rawEvidence);
    store.putFieldEvidence(fieldEvidence);

    expect(store.getRawEvidence('raw-length')).toEqual(rawEvidence);
    expect(store.getFieldEvidence('field-clearance')).toEqual(fieldEvidence);
    store.close();
  });

  test('round-trips a reproducible result snapshot', async () => {
    const { store } = await openStore();
    const snapshot: ResultSnapshot = {
      snapshotFormatVersion: '1.0.0',
      checkedAt: '2026-09-08T00:00:00.000Z',
      engineVersion: '0.1.0',
      ruleSetVersion: '0.1.0',
      policyVersion: '1.0.0',
      canonicalSchemaVersion: '1.1.0',
      identityMapperVersion: '1.0.0',
      providerVersions: [],
      inputSnapshot: {
        build: { schemaVersion: '1.1.0', parts: [cpu] },
        intent: { schemaVersion: '1.0.0', useCase: 'NEW_BUILD' },
        installationContext,
        policyProfile: {
          profileId: 'fixture',
          policyVersion: '1.0.0',
          capabilities: [],
        },
      },
      evidenceSnapshot: { evidenceVersion: '1.0.0', evidenceIds: [] },
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
        ruleResults: [],
      },
    };

    store.putResultSnapshot('snapshot-1', snapshot);

    expect(store.getResultSnapshot('snapshot-1')).toEqual(snapshot);
    store.close();
  });
});
