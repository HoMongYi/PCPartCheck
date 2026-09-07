import { Type, type Static } from '@sinclair/typebox';

import {
  NonNegativeIntegerSchema,
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
