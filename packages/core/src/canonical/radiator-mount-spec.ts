import { Type, type Static } from '@sinclair/typebox';

import {
  PositiveIntegerSchema,
  PositiveNumberSchema,
} from './primitives.js';

export const RadiatorPositionSchema = Type.Union([
  Type.Literal('FRONT'),
  Type.Literal('TOP'),
  Type.Literal('REAR'),
  Type.Literal('BOTTOM'),
  Type.Literal('SIDE'),
]);
export type RadiatorPosition = Static<typeof RadiatorPositionSchema>;

export const RadiatorMountSpecSchema = Type.Object(
  {
    position: RadiatorPositionSchema,
    supportedSizesMm: Type.Array(PositiveIntegerSchema, {
      minItems: 1,
      uniqueItems: true,
    }),
    maxCombinedThicknessMm: Type.Optional(PositiveNumberSchema),
  },
  { additionalProperties: false },
);
export type RadiatorMountSpec = Static<typeof RadiatorMountSpecSchema>;
