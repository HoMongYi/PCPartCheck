import {
  CanonicalPartSchema,
  PartIdSchema,
  PositiveIntegerSchema,
  PositiveNumberSchema,
  type CanonicalPart,
  type PartId,
} from '@pcpartcheck/core';
import { Type, type Static } from '@sinclair/typebox';

import type { ProviderAttribution } from './provider.js';

export const ProviderSourceReferenceSchema = Type.Object(
  {
    providerId: Type.String({ minLength: 1 }),
    providerVersion: Type.String({ minLength: 1 }),
    sourceUri: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);
export type ProviderSourceReference = Static<
  typeof ProviderSourceReferenceSchema
>;

const VerifiedSourceProperties = {
  source: ProviderSourceReferenceSchema,
  evidenceIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  verifiedAt: Type.String({ minLength: 1 }),
} as const;

export const CpuSupportRecordSchema = Type.Object(
  {
    motherboardPartId: PartIdSchema,
    cpuPartId: PartIdSchema,
    supported: Type.Boolean(),
    minimumBiosVersion: Type.Optional(Type.String({ minLength: 1 })),
    ...VerifiedSourceProperties,
  },
  { additionalProperties: false },
);
export type CpuSupportRecord = Static<typeof CpuSupportRecordSchema>;

export const BiosReleaseRecordSchema = Type.Object(
  {
    motherboardPartId: PartIdSchema,
    biosVersion: Type.String({ minLength: 1 }),
    supportedCpuPartIds: Type.Optional(
      Type.Array(PartIdSchema, { uniqueItems: true }),
    ),
    releasedAt: Type.Optional(Type.String({ minLength: 1 })),
    ...VerifiedSourceProperties,
  },
  { additionalProperties: false },
);
export type BiosReleaseRecord = Static<typeof BiosReleaseRecordSchema>;

const MemoryQvlRecordBaseSchema = Type.Object(
  {
    motherboardPartId: PartIdSchema,
    memoryPartId: Type.Optional(PartIdSchema),
    memoryMpn: Type.Optional(Type.String({ minLength: 1 })),
    capacityGb: PositiveNumberSchema,
    moduleCount: PositiveIntegerSchema,
    testedDataRateMtps: PositiveIntegerSchema,
    testedConfiguration: Type.String({ minLength: 1 }),
    ...VerifiedSourceProperties,
  },
  { additionalProperties: false },
);

export const MemoryQvlRecordSchema = Type.Intersect([
  MemoryQvlRecordBaseSchema,
  Type.Union([
    Type.Object({ memoryPartId: PartIdSchema }),
    Type.Object({ memoryMpn: Type.String({ minLength: 1 }) }),
  ]),
]);
export type MemoryQvlRecord = Static<typeof MemoryQvlRecordSchema>;

interface ManufacturerProviderBase {
  readonly providerId: string;
  readonly attribution: ProviderAttribution;
}

export interface ManufacturerSpecificationProvider
  extends ManufacturerProviderBase {
  getSpecification(partId: PartId): Promise<CanonicalPart | undefined>;
}

export interface CpuSupportProvider extends ManufacturerProviderBase {
  listCpuSupport(
    motherboardPartId: PartId,
  ): Promise<readonly CpuSupportRecord[]>;
}

export interface BiosReleaseProvider extends ManufacturerProviderBase {
  listBiosReleases(
    motherboardPartId: PartId,
  ): Promise<readonly BiosReleaseRecord[]>;
}

export interface MemoryQvlProvider extends ManufacturerProviderBase {
  listMemoryQvl(
    motherboardPartId: PartId,
  ): Promise<readonly MemoryQvlRecord[]>;
}

export const ManufacturerSpecificationSchema = CanonicalPartSchema;
