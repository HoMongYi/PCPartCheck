import { Type, type Static, type TSchema } from '@sinclair/typebox';

import {
  CaseFanSpecSchema,
  CpuCoolerSpecSchema,
  CpuSpecSchema,
  GpuSpecSchema,
  MemorySpecSchema,
  MotherboardSpecSchema,
  PcCaseSpecSchema,
  PsuSpecSchema,
  StorageSpecSchema,
} from './part-spec.js';
import { CANONICAL_SCHEMA_VERSION, PartStatusSchema } from './primitives.js';

function canonicalPart(category: string, spec: TSchema) {
  return Type.Object(
    {
      schemaVersion: Type.Literal(CANONICAL_SCHEMA_VERSION),
      partId: Type.String({ minLength: 1 }),
      category: Type.Literal(category),
      manufacturer: Type.String({ minLength: 1 }),
      model: Type.String({ minLength: 1 }),
      mpn: Type.Optional(Type.String({ minLength: 1 })),
      status: PartStatusSchema,
      spec,
    },
    { additionalProperties: false },
  );
}

export const CpuPartSchema = canonicalPart('CPU', CpuSpecSchema);
export const CpuCoolerPartSchema = canonicalPart(
  'CPU_COOLER',
  CpuCoolerSpecSchema,
);
export const GpuPartSchema = canonicalPart('GPU', GpuSpecSchema);
export const MotherboardPartSchema = canonicalPart(
  'MOTHERBOARD',
  MotherboardSpecSchema,
);
export const PcCasePartSchema = canonicalPart('PC_CASE', PcCaseSpecSchema);
export const PsuPartSchema = canonicalPart('PSU', PsuSpecSchema);
export const MemoryPartSchema = canonicalPart('MEMORY', MemorySpecSchema);
export const StoragePartSchema = canonicalPart('STORAGE', StorageSpecSchema);
export const CaseFanPartSchema = canonicalPart('CASE_FAN', CaseFanSpecSchema);

export const CanonicalPartSchema = Type.Union([
  CpuPartSchema,
  CpuCoolerPartSchema,
  GpuPartSchema,
  MotherboardPartSchema,
  PcCasePartSchema,
  PsuPartSchema,
  MemoryPartSchema,
  StoragePartSchema,
  CaseFanPartSchema,
]);
export type CanonicalPart = Static<typeof CanonicalPartSchema>;
export type PartCategory = CanonicalPart['category'];
