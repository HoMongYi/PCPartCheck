import { Type, type Static } from '@sinclair/typebox';

import { NonNegativeIntegerSchema } from './primitives.js';

export const RgbHeaderTypeSchema = Type.Union([
  Type.Literal('ARGB_5V_3_PIN'),
  Type.Literal('RGB_12V_4_PIN'),
]);
export type RgbHeaderType = Static<typeof RgbHeaderTypeSchema>;

export const RgbHeaderSpecSchema = Type.Object(
  {
    type: RgbHeaderTypeSchema,
    count: NonNegativeIntegerSchema,
  },
  { additionalProperties: false },
);
export type RgbHeaderSpec = Static<typeof RgbHeaderSpecSchema>;
