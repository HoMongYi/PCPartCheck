import { Type, type Static } from '@sinclair/typebox';

import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  PositiveNumberSchema,
} from './primitives.js';

export const PowerConnectorTypeSchema = Type.Union([
  Type.Literal('ATX_24_PIN'),
  Type.Literal('EPS_4_PIN'),
  Type.Literal('EPS_8_PIN'),
  Type.Literal('PCIE_6_PIN'),
  Type.Literal('PCIE_8_PIN'),
  Type.Literal('PCIE_12VHPWR'),
  Type.Literal('PCIE_12V_2X6'),
  Type.Literal('SATA_POWER'),
  Type.Literal('MOLEX_4_PIN'),
]);
export type PowerConnectorType = Static<typeof PowerConnectorTypeSchema>;

export const PowerConnectorSpecSchema = Type.Object(
  {
    type: PowerConnectorTypeSchema,
    count: NonNegativeIntegerSchema,
    maxPowerW: Type.Optional(PositiveNumberSchema),
  },
  { additionalProperties: false },
);
export type PowerConnectorSpec = Static<typeof PowerConnectorSpecSchema>;

export const PowerConnectorRequirementModeSchema = Type.Union([
  Type.Literal('REQUIRED'),
  Type.Literal('OPTIONAL'),
  Type.Literal('CONDITIONAL'),
]);
export type PowerConnectorRequirementMode = Static<
  typeof PowerConnectorRequirementModeSchema
>;

export const PowerRequirementConditionSchema = Type.Object(
  {
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const PowerConnectorRequirementSchema = Type.Object(
  {
    type: PowerConnectorTypeSchema,
    count: PositiveIntegerSchema,
    mode: PowerConnectorRequirementModeSchema,
    independentCableCount: Type.Optional(PositiveIntegerSchema),
    condition: Type.Optional(PowerRequirementConditionSchema),
  },
  { additionalProperties: false },
);
export type PowerConnectorRequirement = Static<
  typeof PowerConnectorRequirementSchema
>;

export const PowerAdapterRequirementSchema = Type.Object(
  {
    outputType: PowerConnectorTypeSchema,
    outputCount: PositiveIntegerSchema,
    inputType: PowerConnectorTypeSchema,
    inputCount: PositiveIntegerSchema,
    independentCableCount: Type.Optional(PositiveIntegerSchema),
  },
  { additionalProperties: false },
);
export type PowerAdapterRequirement = Static<
  typeof PowerAdapterRequirementSchema
>;
