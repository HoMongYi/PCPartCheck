import { Type, type Static } from '@sinclair/typebox';

export const CANONICAL_SCHEMA_VERSION = '3.0.0' as const;

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export const JsonValueSchema = Type.Recursive((jsonValue) =>
  Type.Union([
    Type.Null(),
    Type.Boolean(),
    Type.Number(),
    Type.String(),
    Type.Array(jsonValue),
    Type.Record(Type.String(), jsonValue),
  ]),
);

export const PositiveIntegerSchema = Type.Integer({ minimum: 1 });
export const NonNegativeIntegerSchema = Type.Integer({ minimum: 0 });
export const PositiveNumberSchema = Type.Number({ exclusiveMinimum: 0 });
export const PartIdSchema = Type.String({
  pattern:
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
});
export type PartId = Static<typeof PartIdSchema>;

export const CanonicalUnitSchema = Type.Union([
  Type.Literal('mm'),
  Type.Literal('W'),
  Type.Literal('A'),
  Type.Literal('V'),
  Type.Literal('MT/s'),
  Type.Literal('MHz'),
  Type.Literal('GB'),
  Type.Literal('TB'),
]);
export type CanonicalUnit = Static<typeof CanonicalUnitSchema>;

export const PartStatusSchema = Type.Union([
  Type.Literal('ACTIVE'),
  Type.Literal('DISCONTINUED'),
  Type.Literal('UNKNOWN'),
]);
export type PartStatus = Static<typeof PartStatusSchema>;

export const MemoryTechnologySchema = Type.Union([
  Type.Literal('DDR3'),
  Type.Literal('DDR4'),
  Type.Literal('DDR5'),
]);
export type MemoryTechnology = Static<typeof MemoryTechnologySchema>;

export const MotherboardFormFactorSchema = Type.Union([
  Type.Literal('E_ATX'),
  Type.Literal('ATX'),
  Type.Literal('MICRO_ATX'),
  Type.Literal('MINI_ITX'),
]);
export type MotherboardFormFactor = Static<
  typeof MotherboardFormFactorSchema
>;

export const PsuFormFactorSchema = Type.Union([
  Type.Literal('ATX'),
  Type.Literal('SFX'),
  Type.Literal('SFX_L'),
  Type.Literal('TFX'),
  Type.Literal('FLEX_ATX'),
]);
export type PsuFormFactor = Static<typeof PsuFormFactorSchema>;
