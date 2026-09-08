import { Type, type Static } from '@sinclair/typebox';

import type { JsonValue } from './canonical/primitives.js';
import {
  JsonValueSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  PositiveNumberSchema,
} from './canonical/primitives.js';
import { RadiatorPositionSchema } from './canonical/radiator-mount-spec.js';

export const INSTALLATION_CONTEXT_SCHEMA_VERSION = '2.0.0' as const;

export const InstalledRadiatorSchema = Type.Object(
  {
    position: RadiatorPositionSchema,
    sizeMm: PositiveIntegerSchema,
    radiatorThicknessMm: Type.Optional(PositiveNumberSchema),
    fanThicknessMm: Type.Optional(PositiveNumberSchema),
  },
  { additionalProperties: false },
);
export type InstalledRadiator = Static<typeof InstalledRadiatorSchema>;

export const InstalledHddCageSchema = Type.Object(
  {
    cageId: Type.String({ minLength: 1 }),
    position: Type.Union([
      Type.Literal('FRONT'),
      Type.Literal('BOTTOM'),
      Type.Literal('PSU_SHROUD'),
    ]),
    installed: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type InstalledHddCage = Static<typeof InstalledHddCageSchema>;

export const GpuOrientationSchema = Type.Union([
  Type.Literal('HORIZONTAL'),
  Type.Literal('VERTICAL'),
]);
export type GpuOrientation = Static<typeof GpuOrientationSchema>;

export const PciePowerInstallationSchema = Type.Object(
  {
    independentCableCount: Type.Optional(NonNegativeIntegerSchema),
    native12VhpwrCableCount: Type.Optional(NonNegativeIntegerSchema),
    native12V2x6CableCount: Type.Optional(NonNegativeIntegerSchema),
    adapterUsed: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type PciePowerInstallation = Static<
  typeof PciePowerInstallationSchema
>;

export const InstallationContextSchema = Type.Object(
  {
    schemaVersion: Type.Literal(INSTALLATION_CONTEXT_SCHEMA_VERSION),
    radiators: Type.Optional(Type.Array(InstalledRadiatorSchema)),
    hddCages: Type.Optional(Type.Array(InstalledHddCageSchema)),
    gpuOrientation: Type.Optional(GpuOrientationSchema),
    occupiedPcieSlotIds: Type.Optional(
      Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
    ),
    pciePower: Type.Optional(PciePowerInstallationSchema),
    installedBiosVersion: Type.Optional(Type.String({ minLength: 1 })),
    customFacts: Type.Optional(Type.Record(Type.String(), JsonValueSchema)),
  },
  { additionalProperties: false },
);

type InstallationContextValue = Static<typeof InstallationContextSchema>;
export type InstallationContext = Omit<
  InstallationContextValue,
  'customFacts'
> & {
  readonly customFacts?: Readonly<Record<string, JsonValue>>;
};
