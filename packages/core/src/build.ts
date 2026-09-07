import { Type, type Static } from '@sinclair/typebox';

import { CanonicalPartSchema } from './canonical/canonical-part.js';
import { CANONICAL_SCHEMA_VERSION } from './canonical/primitives.js';

export const CanonicalBuildSchema = Type.Object(
  {
    schemaVersion: Type.Literal(CANONICAL_SCHEMA_VERSION),
    parts: Type.Array(CanonicalPartSchema),
  },
  { additionalProperties: false },
);
export type CanonicalBuild = Static<typeof CanonicalBuildSchema>;
