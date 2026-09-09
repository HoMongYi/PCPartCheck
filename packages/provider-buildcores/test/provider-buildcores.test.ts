import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PartId } from '@pcpartcheck/core';
import type { ExternalMapping } from '@pcpartcheck/identity';
import { afterEach, describe, expect, test, vi } from 'vitest';

import * as provider from '../src/index.js';

interface LoadedSnapshot {
  readonly providerVersion: string;
  readonly commitSha: string;
  readonly schemaFingerprint: string;
  readonly records: readonly Readonly<Record<string, unknown>>[];
}

interface ImportResult {
  readonly status: 'IMPORTED' | 'FAILED' | 'SKIPPED';
  readonly externalId?: string;
  readonly category: string;
  readonly sourcePath: string;
  readonly canonicalPart?: Readonly<Record<string, unknown>>;
  readonly externalMapping?: ExternalMapping;
  readonly audit: readonly Readonly<Record<string, unknown>>[];
  readonly reason?: string;
}

interface ImportReport {
  readonly providerVersion: string;
  readonly commitSha: string;
  readonly schemaFingerprint: string;
  readonly attribution: Readonly<Record<string, unknown>>;
  readonly counts: { readonly imported: number; readonly failed: number; readonly skipped: number };
  readonly results: readonly ImportResult[];
}

type SnapshotLoader = (options: Readonly<Record<string, unknown>>) => Promise<LoadedSnapshot>;
type SnapshotImporter = (options: Readonly<Record<string, unknown>>) => ImportReport;

function exportedFunction<T>(name: string): T {
  const candidate = (provider as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeTypeOf('function');
  return candidate as T;
}

const snapshotRoot = fileURLToPath(
  new URL('./fixtures/snapshot', import.meta.url),
);
const commitSha = 'a3795382f9e73c283e3592a8c972842fd0e72e22';
const schemaFingerprint = 'sha256:2c0a21f04687effb7445574465a769ed83bb9f50149880157e7f2dea92505bf9';
const temporarySnapshots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporarySnapshots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function copySnapshotFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcpartcheck-buildcores-'));
  temporarySnapshots.push(root);
  await cp(snapshotRoot, root, { recursive: true });
  return root;
}

async function loadSnapshot(
  rootDir = snapshotRoot,
  expectedSchemaFingerprint = schemaFingerprint,
): Promise<LoadedSnapshot> {
  return exportedFunction<SnapshotLoader>('loadBuildCoresSnapshot')({
    rootDir,
    commitSha,
    schemaFingerprint: expectedSchemaFingerprint,
  });
}

describe('BuildCores snapshot import', () => {
  test('continues only when the expected fingerprint matches the pinned schema files', async () => {
    const snapshot = await loadSnapshot();

    expect(snapshot.schemaFingerprint).toBe(schemaFingerprint);
    expect(snapshot.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'CPU',
          sourceSchemaValidation: { valid: true, errors: [] },
        }),
      ]),
    );
  });

  test('stops snapshot loading when the expected schema fingerprint differs', async () => {
    await expect(
      loadSnapshot(snapshotRoot, `sha256:${'f'.repeat(64)}`),
    ).rejects.toMatchObject({
      code: 'BUILDCORES_SCHEMA_FINGERPRINT_MISMATCH',
      expectedFingerprint: `sha256:${'f'.repeat(64)}`,
      actualFingerprint: schemaFingerprint,
    });
  });

  test('detects a change in the pinned schema file contents', async () => {
    const root = await copySnapshotFixture();
    const cpuSchemaPath = join(root, 'schemas', 'CPU.schema.json');
    const schema = await readFile(cpuSchemaPath, 'utf8');
    await writeFile(cpuSchemaPath, `${schema}\n`, 'utf8');

    await expect(loadSnapshot(root)).rejects.toMatchObject({
      code: 'BUILDCORES_SCHEMA_FINGERPRINT_MISMATCH',
      expectedFingerprint: schemaFingerprint,
      actualFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
  });

  test('fails a JSON record that violates its pinned BuildCores schema before mapping', async () => {
    const root = await copySnapshotFixture();
    const sourcePath = join(root, 'open-db', 'CPU', 'schema-invalid.json');
    await writeFile(
      sourcePath,
      JSON.stringify({
        opendb_id: '99999999-9999-4999-8999-999999999999',
        metadata: 'not-an-object',
      }),
      'utf8',
    );
    const snapshot = await loadSnapshot(root);
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () => '99999999-9999-4999-8999-999999999999',
      importedAt: '2026-09-08T00:00:00.000Z',
    });
    const invalid = report.results.find(
      ({ sourcePath: resultPath }) => resultPath.endsWith('schema-invalid.json'),
    );

    expect(invalid).toMatchObject({
      status: 'FAILED',
      reason: 'SOURCE_SCHEMA_VALIDATION_FAILED',
    });
    expect(invalid).not.toHaveProperty('canonicalPart');
  });

  test('does not import an adapter result rejected by CanonicalPartSchema', async () => {
    const snapshot = await loadSnapshot();
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () => 'not-a-canonical-part-id',
      importedAt: '2026-09-08T00:00:00.000Z',
    });
    const cpu = report.results.find(({ category }) => category === 'CPU');

    expect(cpu).toMatchObject({
      status: 'FAILED',
      reason: 'CANONICAL_SCHEMA_VALIDATION_FAILED',
    });
    expect(cpu).not.toHaveProperty('canonicalPart');
    expect(cpu).not.toHaveProperty('externalMapping');
  });

  test('loads an offline snapshot and reports imported, failed, and skipped records', async () => {
    const snapshot = await loadSnapshot();
    let nextId = 1;
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () =>
        `a0000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}` as PartId,
      importedAt: '2026-09-08T00:00:00.000Z',
    });

    expect(report).toMatchObject({
      providerVersion: `commit:${commitSha}`,
      commitSha,
      schemaFingerprint,
      counts: { imported: 9, failed: 1, skipped: 1 },
      attribution: {
        license: 'ODC-By-1.0',
        attributionRequired: true,
      },
    });
  });

  test.each([
    ['Motherboard', 'MOTHERBOARD'],
    ['GPU', 'GPU'],
    ['CPUCooler', 'CPU_COOLER'],
    ['PCCase', 'PC_CASE'],
    ['PSU', 'PSU'],
    ['Storage', 'STORAGE'],
  ] as const)('maps safe %s fields to %s', async (sourceCategory, canonicalCategory) => {
    const snapshot = await loadSnapshot();
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      importedAt: '2026-09-08T00:00:00.000Z',
    });
    const result = report.results.find(({ category }) => category === sourceCategory);

    expect(result).toMatchObject({
      status: 'IMPORTED',
      canonicalPart: { schemaVersion: '3.0.0', category: canonicalCategory },
    });
  });

  test('does not invent ambiguous motherboard PCIe or power requirement semantics', async () => {
    const snapshot = await loadSnapshot();
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      importedAt: '2026-09-08T00:00:00.000Z',
    });
    const result = report.results.find(({ category }) => category === 'Motherboard');

    expect(result?.canonicalPart).not.toHaveProperty('spec.pcieSlots');
    expect(result?.canonicalPart).not.toHaveProperty(
      'spec.powerConnectorRequirements',
    );
  });

  test('maps GPU link capability without inventing physical lanes or peak power', async () => {
    const snapshot = await loadSnapshot();
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      importedAt: '2026-09-08T00:00:00.000Z',
    });
    const result = report.results.find(({ category }) => category === 'GPU');

    expect(result?.canonicalPart).toMatchObject({
      spec: {
        lengthMm: 240,
        slotWidth: 2,
        pcieGeneration: 4,
        maxLinkWidthLanes: 8,
        powerConnectorRequirements: [
          { type: 'PCIE_8_PIN', count: 1, mode: 'REQUIRED' },
        ],
      },
    });
    expect(result?.canonicalPart).not.toHaveProperty('spec.physicalConnectorLanes');
    expect(result?.canonicalPart).not.toHaveProperty('spec.peakPowerW');
  });

  test('imports partial CaseFan data without inventing missing thickness', async () => {
    const snapshot = await loadSnapshot();
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      importedAt: '2026-09-08T00:00:00.000Z',
    });

    const result = report.results.find(({ category }) => category === 'CaseFan');
    expect(result).toMatchObject({
      category: 'CaseFan',
      status: 'IMPORTED',
      canonicalPart: {
        category: 'CASE_FAN',
        spec: { diameterMm: 140, connector: 'PWM_4_PIN' },
      },
    });
    expect(result?.canonicalPart).not.toHaveProperty('spec.thicknessMm');
  });

  test('maps RAM.speed only as a provider semantic alias to dataRateMtps', async () => {
    const snapshot = await loadSnapshot();
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () => '33333333-3333-4333-8333-333333333333',
      importedAt: '2026-09-08T00:00:00.000Z',
    });
    const memory = report.results.find(
      (result) => result.externalId === '000c0c27-8b0a-4760-92ec-89ef39e630d8',
    );

    expect(memory).toMatchObject({
      status: 'IMPORTED',
      canonicalPart: {
        schemaVersion: '3.0.0',
        category: 'MEMORY',
        mpn: 'EX-6400-48',
        spec: {
          technology: 'DDR5',
          formFactor: 'DIMM',
          moduleCount: 2,
          capacityPerModuleGb: 24,
          dataRateMtps: 6400,
          heightMm: 34,
        },
      },
      audit: expect.arrayContaining([
        expect.objectContaining({
          sourcePath: 'speed',
          targetPath: 'spec.dataRateMtps',
          rawValue: 6400,
          rawUnit: 'MHz',
          canonicalValue: 6400,
          canonicalUnit: 'MT/s',
          mappingKind: 'SOURCE_SEMANTIC_ALIAS',
          mappingRule: 'BUILDCORES_RAM_SPEED_MARKETED_DATA_RATE',
          mapperVersion: '3.0.0',
        }),
      ]),
    });
    expect(memory?.canonicalPart).not.toHaveProperty('spec.clockMHz');
  });

  test('reuses an existing mapping instead of creating another UUID', async () => {
    const snapshot = await loadSnapshot();
    const stablePartId = '55555555-5555-4555-8555-555555555555';
    const existingMapping: ExternalMapping = {
      source: 'buildcores-open-db',
      externalId: '000c0c27-8b0a-4760-92ec-89ef39e630d8',
      partId: stablePartId,
      rawName: 'Earlier label',
      matchMethod: 'NEW_PART',
      confidence: 'HIGH',
      status: 'CONFIRMED',
      matchedAt: '2026-09-07T00:00:00.000Z',
      mapperVersion: '1.0.0',
    };
    const createPartId = vi.fn(() => '66666666-6666-4666-8666-666666666666');
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [existingMapping],
      canonicalIdentities: [],
      createPartId,
      importedAt: '2026-09-08T00:00:00.000Z',
    });
    const memory = report.results.find(
      (result) => result.externalId === existingMapping.externalId,
    );

    expect(memory?.canonicalPart).toMatchObject({ partId: stablePartId });
    expect(createPartId).toHaveBeenCalledTimes(8);
  });

  test('preserves a CPU power limit as canonical peak power', async () => {
    const snapshot = await loadSnapshot();
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () => '77777777-7777-4777-8777-777777777777',
      importedAt: '2026-09-08T00:00:00.000Z',
    });
    const cpu = report.results.find(
      (result) => result.externalId === '11111111-1111-4111-8111-111111111111',
    );

    expect(cpu).toMatchObject({
      status: 'IMPORTED',
      canonicalPart: {
        category: 'CPU',
        spec: {
          socket: 'AM5',
          coreCount: 8,
          threadCount: 16,
          tdpW: 120,
          peakPowerW: 162,
          supportedMemoryTechnologies: ['DDR5'],
        },
      },
    });
  });

  test('fails malformed source data and skips unsupported categories', async () => {
    const snapshot = await loadSnapshot();
    const report = exportedFunction<SnapshotImporter>('importBuildCoresSnapshot')({
      snapshot,
      existingMappings: [],
      canonicalIdentities: [],
      createPartId: () => '77777777-7777-4777-8777-777777777777',
      importedAt: '2026-09-08T00:00:00.000Z',
    });

    expect(report.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'RAM', status: 'FAILED' }),
        expect.objectContaining({ category: 'Accessory', status: 'SKIPPED' }),
      ]),
    );
  });
});
