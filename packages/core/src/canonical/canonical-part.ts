import { Type, type Static, type TSchema } from '@sinclair/typebox';

import {
  CaseFanSpecSchema,
  CpuCoolerSpecSchema,
  CpuSpecSchema,
  GpuSpecSchema,
  MemorySpecSchema,
  MotherboardSpecSchema,
  PcCaseSpecSchema,
  PcieCardSpecSchema,
  PsuSpecSchema,
  StorageSpecSchema,
} from './part-spec.js';
import {
  CANONICAL_SCHEMA_VERSION,
  PartIdSchema,
  PartStatusSchema,
} from './primitives.js';

function canonicalPart<
  const TCategory extends string,
  const TSpec extends TSchema,
>(category: TCategory, spec: TSpec) {
  return Type.Object(
    {
      schemaVersion: Type.Literal(CANONICAL_SCHEMA_VERSION),
      partId: PartIdSchema,
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
export const PcieCardPartSchema = canonicalPart('PCIE_CARD', PcieCardSpecSchema);

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
  PcieCardPartSchema,
]);
export type CanonicalPart = Static<typeof CanonicalPartSchema>;
export type PartCategory = CanonicalPart['category'];
