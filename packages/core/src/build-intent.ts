import { Type, type Static } from '@sinclair/typebox';

import {
  PartIdSchema,
  PositiveIntegerSchema,
} from './canonical/primitives.js';

export const BUILD_INTENT_SCHEMA_VERSION = '1.0.0' as const;

export const BuildUseCaseSchema = Type.Union([
  Type.Literal('NEW_BUILD'),
  Type.Literal('UPGRADE'),
  Type.Literal('REPLACEMENT'),
  Type.Literal('COMPATIBILITY_CHECK'),
]);
export type BuildUseCase = Static<typeof BuildUseCaseSchema>;

export const BuildPartSelectionSchema = Type.Object(
  {
    partId: PartIdSchema,
    quantity: PositiveIntegerSchema,
  },
  { additionalProperties: false },
);
export type BuildPartSelection = Static<typeof BuildPartSelectionSchema>;

export const RequestedPartChangeSchema = Type.Object(
  {
    category: Type.Union([
      Type.Literal('CPU'),
      Type.Literal('CPU_COOLER'),
      Type.Literal('GPU'),
      Type.Literal('MOTHERBOARD'),
      Type.Literal('PC_CASE'),
      Type.Literal('PSU'),
      Type.Literal('MEMORY'),
      Type.Literal('STORAGE'),
      Type.Literal('CASE_FAN'),
      Type.Literal('PCIE_CARD'),
    ]),
    replacedPartId: Type.Optional(PartIdSchema),
    candidatePartId: Type.Optional(PartIdSchema),
  },
  { additionalProperties: false },
);
export type RequestedPartChange = Static<typeof RequestedPartChangeSchema>;

export const BuildIntentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(BUILD_INTENT_SCHEMA_VERSION),
    useCase: BuildUseCaseSchema,
    existingParts: Type.Optional(Type.Array(BuildPartSelectionSchema)),
    requestedChanges: Type.Optional(Type.Array(RequestedPartChangeSchema)),
    preservedParts: Type.Optional(Type.Array(BuildPartSelectionSchema)),
  },
  { additionalProperties: false },
);
export type BuildIntent = Static<typeof BuildIntentSchema>;
