import { Type, type Static } from '@sinclair/typebox';

import { PositiveIntegerSchema } from './primitives.js';

export const M2KeySchema = Type.Union([
  Type.Literal('B'),
  Type.Literal('M'),
  Type.Literal('B_M'),
  Type.Literal('E'),
]);
export type M2Key = Static<typeof M2KeySchema>;

export const M2InterfaceSchema = Type.Union([
  Type.Literal('PCIE_NVME'),
  Type.Literal('SATA'),
]);
export type M2Interface = Static<typeof M2InterfaceSchema>;

export const M2FormFactorSchema = Type.Union([
  Type.Literal(2230),
  Type.Literal(2242),
  Type.Literal(2260),
  Type.Literal(2280),
  Type.Literal(22110),
]);
export type M2FormFactor = Static<typeof M2FormFactorSchema>;

export const M2SlotSpecSchema = Type.Object(
  {
    slotId: Type.String({ minLength: 1 }),
    key: M2KeySchema,
    formFactors: Type.Array(M2FormFactorSchema, { minItems: 1, uniqueItems: true }),
    interfaces: Type.Array(M2InterfaceSchema, { minItems: 1, uniqueItems: true }),
    pcieGen: Type.Optional(PositiveIntegerSchema),
    lanes: Type.Optional(PositiveIntegerSchema),
    sharedSataPortIds: Type.Optional(
      Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
    ),
  },
  { additionalProperties: false },
);
export type M2SlotSpec = Static<typeof M2SlotSpecSchema>;
