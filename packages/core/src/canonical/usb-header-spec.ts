import { Type, type Static } from '@sinclair/typebox';

import { NonNegativeIntegerSchema } from './primitives.js';

export const UsbHeaderTypeSchema = Type.Union([
  Type.Literal('USB_2_0'),
  Type.Literal('USB_3_2_GEN1'),
  Type.Literal('USB_3_2_GEN2_TYPE_E'),
  Type.Literal('USB4'),
]);
export type UsbHeaderType = Static<typeof UsbHeaderTypeSchema>;

export const UsbHeaderSpecSchema = Type.Object(
  {
    type: UsbHeaderTypeSchema,
    count: NonNegativeIntegerSchema,
  },
  { additionalProperties: false },
);
export type UsbHeaderSpec = Static<typeof UsbHeaderSpecSchema>;
