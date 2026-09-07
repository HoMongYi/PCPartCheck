import { Type, type Static } from '@sinclair/typebox';

import {
  NonNegativeIntegerSchema,
  PositiveNumberSchema,
} from './primitives.js';

export const FanHeaderTypeSchema = Type.Union([
  Type.Literal('CPU_FAN'),
  Type.Literal('CPU_OPT'),
  Type.Literal('SYSTEM_FAN'),
  Type.Literal('AIO_PUMP'),
  Type.Literal('WATER_PUMP'),
]);
export type FanHeaderType = Static<typeof FanHeaderTypeSchema>;

export const FanConnectorTypeSchema = Type.Union([
  Type.Literal('DC_3_PIN'),
  Type.Literal('PWM_4_PIN'),
]);
export type FanConnectorType = Static<typeof FanConnectorTypeSchema>;

export const FanHeaderSpecSchema = Type.Object(
  {
    type: FanHeaderTypeSchema,
    connector: FanConnectorTypeSchema,
    count: NonNegativeIntegerSchema,
    maxCurrentA: Type.Optional(PositiveNumberSchema),
  },
  { additionalProperties: false },
);
export type FanHeaderSpec = Static<typeof FanHeaderSpecSchema>;
