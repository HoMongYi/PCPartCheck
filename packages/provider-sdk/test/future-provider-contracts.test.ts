import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { describe, expect, expectTypeOf, test } from 'vitest';

import * as sdk from '../src/index.js';
import type {
  BiosReleaseProvider,
  CpuSupportProvider,
  ManufacturerSpecificationProvider,
  MemoryQvlProvider,
} from '../src/index.js';

function schema(name: string): TSchema {
  const candidate = (sdk as Readonly<Record<string, unknown>>)[name];
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as TSchema;
}

const source = {
  providerId: 'manufacturer-docs',
  providerVersion: '2026-09-09',
  sourceUri: 'https://example.invalid/support',
};

describe('future manufacturer provider domain schemas', () => {
  test('validates CPU support and BIOS release records with source evidence', () => {
    expect(Value.Check(schema('CpuSupportRecordSchema'), {
      motherboardPartId: '11111111-1111-4111-8111-111111111111',
      cpuPartId: '22222222-2222-4222-8222-222222222222',
      supported: true,
      minimumBiosVersion: 'F12',
      source,
      evidenceIds: ['manufacturer-cpu-list-1'],
      verifiedAt: '2026-09-09T00:00:00.000Z',
    })).toBe(true);
    expect(Value.Check(schema('BiosReleaseRecordSchema'), {
      motherboardPartId: '11111111-1111-4111-8111-111111111111',
      biosVersion: 'F12',
      supportedCpuPartIds: ['22222222-2222-4222-8222-222222222222'],
      source,
      evidenceIds: ['manufacturer-bios-1'],
      verifiedAt: '2026-09-09T00:00:00.000Z',
    })).toBe(true);
    expect(Value.Check(schema('BiosReleaseRecordSchema'), {
      motherboardPartId: '11111111-1111-4111-8111-111111111111',
      biosVersion: 'F12',
      source,
      evidenceIds: [],
      verifiedAt: '2026-09-09T00:00:00.000Z',
    })).toBe(false);
  });

  test('requires a canonical memory identity or MPN for a QVL record', () => {
    const qvl = {
      motherboardPartId: '11111111-1111-4111-8111-111111111111',
      memoryMpn: 'EX-DDR5-6000-32G',
      capacityGb: 32,
      moduleCount: 2,
      testedDataRateMtps: 6000,
      testedConfiguration: '2 x 16 GB, EXPO enabled',
      source,
      evidenceIds: ['manufacturer-qvl-1'],
      verifiedAt: '2026-09-09T00:00:00.000Z',
    };
    expect(Value.Check(schema('MemoryQvlRecordSchema'), qvl)).toBe(true);
    const withoutIdentity = Object.fromEntries(
      Object.entries(qvl).filter(([key]) => key !== 'memoryMpn'),
    );
    expect(Value.Check(schema('MemoryQvlRecordSchema'), withoutIdentity)).toBe(false);
  });
});

test('provider roles remain optional provider-neutral interfaces', () => {
  expectTypeOf<ManufacturerSpecificationProvider>().toMatchTypeOf<{
    getSpecification(partId: string): Promise<unknown>;
  }>();
  expectTypeOf<CpuSupportProvider>().toMatchTypeOf<{
    listCpuSupport(motherboardPartId: string): Promise<unknown>;
  }>();
  expectTypeOf<BiosReleaseProvider>().toMatchTypeOf<{
    listBiosReleases(motherboardPartId: string): Promise<unknown>;
  }>();
  expectTypeOf<MemoryQvlProvider>().toMatchTypeOf<{
    listMemoryQvl(motherboardPartId: string): Promise<unknown>;
  }>();
});
