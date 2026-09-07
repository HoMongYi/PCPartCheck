import { Type, type Static } from '@sinclair/typebox';

import { FanConnectorTypeSchema, FanHeaderSpecSchema } from './fan-header-spec.js';
import { M2SlotSpecSchema } from './m2-slot-spec.js';
import { PcieSlotSpecSchema } from './pcie-slot-spec.js';
import { PowerConnectorSpecSchema } from './power-connector-spec.js';
import {
  MemoryTechnologySchema,
  MotherboardFormFactorSchema,
  PositiveIntegerSchema,
  PositiveNumberSchema,
  PsuFormFactorSchema,
} from './primitives.js';
import { RadiatorMountSpecSchema } from './radiator-mount-spec.js';
import { RgbHeaderSpecSchema, RgbHeaderTypeSchema } from './rgb-header-spec.js';
import { UsbHeaderSpecSchema } from './usb-header-spec.js';

export const CpuSpecSchema = Type.Object(
  {
    socket: Type.String({ minLength: 1 }),
    coreCount: Type.Optional(PositiveIntegerSchema),
    threadCount: Type.Optional(PositiveIntegerSchema),
    tdpW: Type.Optional(PositiveNumberSchema),
    peakPowerW: Type.Optional(PositiveNumberSchema),
    supportedMemoryTechnologies: Type.Optional(
      Type.Array(MemoryTechnologySchema, { uniqueItems: true }),
    ),
  },
  { additionalProperties: false },
);
export type CpuSpec = Static<typeof CpuSpecSchema>;

export const CpuCoolerSpecSchema = Type.Object(
  {
    coolerType: Type.Union([
      Type.Literal('AIR'),
      Type.Literal('AIO'),
      Type.Literal('CUSTOM_LOOP'),
    ]),
    supportedSockets: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      uniqueItems: true,
    }),
    heightMm: Type.Optional(PositiveNumberSchema),
    radiatorSizeMm: Type.Optional(PositiveIntegerSchema),
    radiatorThicknessMm: Type.Optional(PositiveNumberSchema),
    fanThicknessMm: Type.Optional(PositiveNumberSchema),
    peakPowerW: Type.Optional(PositiveNumberSchema),
  },
  { additionalProperties: false },
);
export type CpuCoolerSpec = Static<typeof CpuCoolerSpecSchema>;

export const GpuSpecSchema = Type.Object(
  {
    lengthMm: Type.Optional(PositiveNumberSchema),
    heightMm: Type.Optional(PositiveNumberSchema),
    thicknessMm: Type.Optional(PositiveNumberSchema),
    slotWidth: Type.Optional(PositiveNumberSchema),
    peakPowerW: Type.Optional(PositiveNumberSchema),
    vendorRecommendedPsuW: Type.Optional(PositiveNumberSchema),
    powerConnectors: Type.Optional(Type.Array(PowerConnectorSpecSchema)),
    pcieGeneration: Type.Optional(PositiveIntegerSchema),
    pcieLanes: Type.Optional(PositiveIntegerSchema),
  },
  { additionalProperties: false },
);
export type GpuSpec = Static<typeof GpuSpecSchema>;

export const MotherboardSpecSchema = Type.Object(
  {
    socket: Type.String({ minLength: 1 }),
    chipset: Type.Optional(Type.String({ minLength: 1 })),
    formFactor: MotherboardFormFactorSchema,
    memoryTechnologies: Type.Array(MemoryTechnologySchema, {
      minItems: 1,
      uniqueItems: true,
    }),
    memorySlots: Type.Optional(PositiveIntegerSchema),
    maxMemoryGb: Type.Optional(PositiveIntegerSchema),
    supportedDataRatesMtps: Type.Optional(
      Type.Array(PositiveIntegerSchema, { uniqueItems: true }),
    ),
    powerConnectors: Type.Optional(Type.Array(PowerConnectorSpecSchema)),
    fanHeaders: Type.Optional(Type.Array(FanHeaderSpecSchema)),
    rgbHeaders: Type.Optional(Type.Array(RgbHeaderSpecSchema)),
    usbHeaders: Type.Optional(Type.Array(UsbHeaderSpecSchema)),
    m2Slots: Type.Optional(Type.Array(M2SlotSpecSchema)),
    pcieSlots: Type.Optional(Type.Array(PcieSlotSpecSchema)),
  },
  { additionalProperties: false },
);
export type MotherboardSpec = Static<typeof MotherboardSpecSchema>;

export const PcCaseSpecSchema = Type.Object(
  {
    supportedMotherboardFormFactors: Type.Array(MotherboardFormFactorSchema, {
      minItems: 1,
      uniqueItems: true,
    }),
    supportedPsuFormFactors: Type.Optional(
      Type.Array(PsuFormFactorSchema, { uniqueItems: true }),
    ),
    maxGpuLengthMm: Type.Optional(PositiveNumberSchema),
    maxCpuCoolerHeightMm: Type.Optional(PositiveNumberSchema),
    maxPsuLengthMm: Type.Optional(PositiveNumberSchema),
    radiatorMounts: Type.Optional(Type.Array(RadiatorMountSpecSchema)),
    pcieSlotCount: Type.Optional(PositiveIntegerSchema),
  },
  { additionalProperties: false },
);
export type PcCaseSpec = Static<typeof PcCaseSpecSchema>;

export const PsuSpecSchema = Type.Object(
  {
    formFactor: PsuFormFactorSchema,
    ratedPowerW: PositiveNumberSchema,
    atxVersion: Type.Optional(Type.String({ minLength: 1 })),
    powerConnectors: Type.Array(PowerConnectorSpecSchema),
  },
  { additionalProperties: false },
);
export type PsuSpec = Static<typeof PsuSpecSchema>;

export const MemorySpecSchema = Type.Object(
  {
    technology: MemoryTechnologySchema,
    formFactor: Type.Union([Type.Literal('DIMM'), Type.Literal('SO_DIMM')]),
    moduleCount: PositiveIntegerSchema,
    capacityPerModuleGb: PositiveNumberSchema,
    dataRateMtps: Type.Optional(PositiveIntegerSchema),
    clockMHz: Type.Optional(PositiveNumberSchema),
    heightMm: Type.Optional(PositiveNumberSchema),
  },
  { additionalProperties: false },
);
export type MemorySpec = Static<typeof MemorySpecSchema>;

export const StorageSpecSchema = Type.Object(
  {
    storageType: Type.Union([
      Type.Literal('NVME_SSD'),
      Type.Literal('SATA_SSD'),
      Type.Literal('HDD'),
    ]),
    capacityGb: PositiveNumberSchema,
    interface: Type.Union([
      Type.Literal('PCIE_NVME'),
      Type.Literal('SATA'),
    ]),
    m2FormFactor: Type.Optional(
      Type.Union([
        Type.Literal(2230),
        Type.Literal(2242),
        Type.Literal(2260),
        Type.Literal(2280),
        Type.Literal(22110),
      ]),
    ),
    peakPowerW: Type.Optional(PositiveNumberSchema),
  },
  { additionalProperties: false },
);
export type StorageSpec = Static<typeof StorageSpecSchema>;

export const CaseFanSpecSchema = Type.Object(
  {
    diameterMm: PositiveIntegerSchema,
    thicknessMm: PositiveNumberSchema,
    connector: FanConnectorTypeSchema,
    maxCurrentA: Type.Optional(PositiveNumberSchema),
    rgbConnector: Type.Optional(RgbHeaderTypeSchema),
    peakPowerW: Type.Optional(PositiveNumberSchema),
  },
  { additionalProperties: false },
);
export type CaseFanSpec = Static<typeof CaseFanSpecSchema>;
