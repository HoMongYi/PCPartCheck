import { Type, type Static } from '@sinclair/typebox';

import { PositiveIntegerSchema } from './primitives.js';

export const PcieSlotSpecSchema = Type.Object(
  {
    slotId: Type.String({ minLength: 1 }),
    generation: PositiveIntegerSchema,
    lanes: PositiveIntegerSchema,
    positionIndex: PositiveIntegerSchema,
  },
  { additionalProperties: false },
);
export type PcieSlotSpec = Static<typeof PcieSlotSpecSchema>;
