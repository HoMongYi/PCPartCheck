import { describe, expect, test, vi } from 'vitest';

import * as identity from '../src/index.js';

type Resolver = (input: Readonly<Record<string, unknown>>) => {
  readonly outcome: string;
  readonly partId?: string;
  readonly matchMethod?: string;
  readonly mapping?: Readonly<Record<string, unknown>>;
};

function resolver(): Resolver {
  const candidate = (identity as Readonly<Record<string, unknown>>)
    .resolveCanonicalIdentity;
  expect(candidate, 'resolveCanonicalIdentity must be exported').toBeDefined();
  return candidate as Resolver;
}

const existingPartId = '11111111-1111-4111-8111-111111111111';
const newPartId = '22222222-2222-4222-8222-222222222222';

const incoming = {
  source: 'catalog-a',
  externalId: 'gpu-100',
  category: 'GPU',
  manufacturer: 'Example Tech',
  model: 'Fast GPU 16GB',
  identifiers: { mpn: 'EX-GPU-16', gtin: '01234567890123' },
  criticalSpecs: { memoryGb: 16, chipset: 'FAST-100' },
} as const;

const canonical = {
  partId: existingPartId,
  category: 'GPU',
  manufacturer: 'Example Tech',
  model: 'Fast GPU 16 GB',
  identifiers: { mpn: 'EX-GPU-16', gtin: '01234567890123' },
  criticalSpecs: { memoryGb: 16, chipset: 'FAST-100' },
} as const;

describe('resolveCanonicalIdentity', () => {
  test('reuses an existing ExternalMapping before all other matching', () => {
    const result = resolver()({
      incoming: { ...incoming, manufacturer: 'Changed label' },
      mappings: [
        {
          source: 'catalog-a',
          externalId: 'gpu-100',
          partId: existingPartId,
          matchMethod: 'EXTERNAL_MAPPING',
          mapperVersion: '1.0.0',
        },
      ],
      canonicalIdentities: [],
      createPartId: () => newPartId,
      mapperVersion: '1.0.0',
    });

    expect(result).toMatchObject({
      outcome: 'MATCHED',
      partId: existingPartId,
      matchMethod: 'EXTERNAL_MAPPING',
    });
  });

  test.each(['mpn', 'gtin'] as const)(
    'reuses a canonical identity on exact normalized %s',
    (identifier) => {
      const result = resolver()({
        incoming: {
          ...incoming,
          identifiers: { [identifier]: incoming.identifiers[identifier].toLowerCase() },
        },
        mappings: [],
        canonicalIdentities: [canonical],
        createPartId: () => newPartId,
        mapperVersion: '1.0.0',
      });

      expect(result).toMatchObject({
        outcome: 'MATCHED',
        partId: existingPartId,
        matchMethod: 'GLOBAL_IDENTIFIER',
      });
    },
  );

  test('rejects an identifier match when a critical specification conflicts', () => {
    const result = resolver()({
      incoming: {
        ...incoming,
        criticalSpecs: { memoryGb: 12, chipset: 'FAST-100' },
      },
      mappings: [],
      canonicalIdentities: [canonical],
      createPartId: () => newPartId,
      mapperVersion: '1.0.0',
      matchedAt: '2026-09-08T00:00:00.000Z',
    });

    expect(result).toMatchObject({ outcome: 'REJECTED' });
  });

  test('matches normalized manufacturer/model only when critical specs agree', () => {
    const result = resolver()({
      incoming: { ...incoming, identifiers: {} },
      mappings: [],
      canonicalIdentities: [{ ...canonical, identifiers: {} }],
      createPartId: () => newPartId,
      mapperVersion: '1.0.0',
    });

    expect(result).toMatchObject({
      outcome: 'MATCHED',
      partId: existingPartId,
      matchMethod: 'MANUFACTURER_MODEL_SPECS',
    });
  });

  test('rejects a same-name candidate when a critical spec conflicts', () => {
    const result = resolver()({
      incoming: {
        ...incoming,
        identifiers: {},
        criticalSpecs: { memoryGb: 12, chipset: 'FAST-100' },
      },
      mappings: [],
      canonicalIdentities: [{ ...canonical, identifiers: {} }],
      createPartId: () => newPartId,
      mapperVersion: '1.0.0',
    });

    expect(result).toMatchObject({ outcome: 'REJECTED' });
  });

  test('sends a similar-name-only candidate to review instead of merging it', () => {
    const result = resolver()({
      incoming: {
        ...incoming,
        identifiers: {},
        model: 'Fast GPU 16GB OC',
      },
      mappings: [],
      canonicalIdentities: [{ ...canonical, identifiers: {} }],
      createPartId: () => newPartId,
      mapperVersion: '1.0.0',
    });

    expect(result).toMatchObject({ outcome: 'REVIEW_REQUIRED' });
  });

  test('creates an id only for a genuinely new part', () => {
    const createPartId = vi.fn(() => newPartId);
    const result = resolver()({
      incoming,
      mappings: [],
      canonicalIdentities: [],
      createPartId,
      mapperVersion: '1.0.0',
      matchedAt: '2026-09-08T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      outcome: 'NEW',
      partId: newPartId,
      mapping: {
        rawName: 'Example Tech Fast GPU 16GB',
        confidence: 'HIGH',
        status: 'CONFIRMED',
        matchedAt: '2026-09-08T00:00:00.000Z',
        mapperVersion: '1.0.0',
      },
    });
    expect(createPartId).toHaveBeenCalledOnce();
  });

  test('returns a mapping that keeps the generated id stable on re-import', () => {
    const createPartId = vi.fn(() => newPartId);
    const first = resolver()({
      incoming,
      mappings: [],
      canonicalIdentities: [],
      createPartId,
      mapperVersion: '1.0.0',
    });
    const second = resolver()({
      incoming,
      mappings: [first.mapping],
      canonicalIdentities: [],
      createPartId,
      mapperVersion: '1.0.0',
    });

    expect(second).toMatchObject({ outcome: 'MATCHED', partId: newPartId });
    expect(createPartId).toHaveBeenCalledOnce();
  });
});
