import type {
  CanonicalPart,
  JsonValue,
  MemoryTechnology,
  MotherboardFormFactor,
  PartId,
  PowerConnectorRequirement,
  PowerConnectorSpec,
  PsuFormFactor,
} from '@pcpartcheck/core';
import { CANONICAL_SCHEMA_VERSION } from '@pcpartcheck/core';
import {
  IDENTITY_MAPPER_VERSION,
  resolveCanonicalIdentity,
  type PartIdentifiers,
} from '@pcpartcheck/identity';
import type { ProviderFieldAudit } from '@pcpartcheck/provider-sdk';
import { normalizeUnit } from '@pcpartcheck/unit-normalization';

import {
  BUILDCORES_ATTRIBUTION,
  BUILDCORES_MAPPER_VERSION,
  BUILDCORES_PROVIDER_ID,
  type BuildCoresImportReport,
  type BuildCoresImportResult,
  type BuildCoresSnapshotRecord,
  type ImportBuildCoresSnapshotOptions,
  type MappedBuildCoresPart,
} from './types.js';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function object(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const number = positiveNumber(value);
  return number !== undefined && Number.isInteger(number) ? number : undefined;
}

function memoryTechnology(value: unknown): MemoryTechnology | undefined {
  return value === 'DDR3' || value === 'DDR4' || value === 'DDR5'
    ? value
    : undefined;
}

function metadata(data: Readonly<Record<string, unknown>>):
  | { readonly name: string; readonly manufacturer: string; readonly partNumbers: readonly string[] }
  | undefined {
  const value = object(data.metadata);
  const name = nonEmptyString(value?.name);
  const manufacturer = nonEmptyString(value?.manufacturer);
  if (!name || !manufacturer) return undefined;
  const partNumbers = Array.isArray(value?.part_numbers)
    ? value.part_numbers.flatMap((partNumber) => {
        const parsed = nonEmptyString(partNumber);
        return parsed ? [parsed] : [];
      })
    : [];
  return { name, manufacturer, partNumbers };
}

function identifiers(
  data: Readonly<Record<string, unknown>>,
  partNumbers: readonly string[],
): PartIdentifiers {
  const result: { mpn?: string; gtin?: string; ean?: string; upc?: string } = {};
  const values = object(data.identifiers)?.identifiers;
  if (Array.isArray(values)) {
    for (const value of values) {
      const entry = object(value);
      const type = entry?.type;
      const identifier = nonEmptyString(entry?.value);
      if (
        identifier &&
        (type === 'mpn' || type === 'gtin' || type === 'ean' || type === 'upc') &&
        result[type] === undefined
      ) {
        result[type] = identifier;
      }
    }
  }
  if (!result.mpn && partNumbers[0]) result.mpn = partNumbers[0];
  return result;
}

function unitAudit(
  sourcePath: string,
  targetPath: string,
  rawValue: number,
  rawUnit: 'mm' | 'W',
): { readonly value: number; readonly audit: ProviderFieldAudit } {
  const normalized = normalizeUnit({
    rawEvidence: { rawValue, rawUnit },
    targetFieldPath: targetPath,
    targetUnit: rawUnit,
  });
  if (normalized.status !== 'NORMALIZED') {
    throw new Error(`BuildCores unit normalization failed for ${sourcePath}`);
  }
  return {
    value: normalized.value,
    audit: {
      sourcePath,
      targetPath,
      rawValue,
      rawUnit,
      canonicalValue: normalized.value,
      canonicalUnit: normalized.unit,
      mappingKind: 'UNIT_NORMALIZATION',
      mappingRule: normalized.audit.ruleId,
      mapperVersion: BUILDCORES_MAPPER_VERSION,
    },
  };
}

function directAudit(
  sourcePath: string,
  targetPath: string,
  rawValue: JsonValue,
  canonicalValue: JsonValue,
): ProviderFieldAudit {
  return {
    sourcePath,
    targetPath,
    rawValue,
    canonicalValue,
    mappingKind: 'DIRECT',
    mappingRule: 'BUILDCORES_DIRECT_FIELD',
    mapperVersion: BUILDCORES_MAPPER_VERSION,
  };
}

function motherboardFormFactor(value: unknown): MotherboardFormFactor | undefined {
  switch (nonEmptyString(value)?.toLocaleLowerCase('en-US').replaceAll(/[^a-z]/gu, '')) {
    case 'eatx': return 'E_ATX';
    case 'atx': return 'ATX';
    case 'microatx': return 'MICRO_ATX';
    case 'miniitx': return 'MINI_ITX';
    default: return undefined;
  }
}

function psuFormFactor(value: unknown): PsuFormFactor | undefined {
  switch (nonEmptyString(value)?.toLocaleUpperCase('en-US').replaceAll(/[^A-Z]/gu, '')) {
    case 'ATX': return 'ATX';
    case 'SFX': return 'SFX';
    case 'SFXL': return 'SFX_L';
    case 'TFX': return 'TFX';
    case 'FLEXATX': return 'FLEX_ATX';
    default: return undefined;
  }
}

function pcieInterface(value: unknown):
  | { readonly generation?: number; readonly lanes: number }
  | undefined {
  const text = nonEmptyString(value);
  if (!text) return undefined;
  const lanes = /x(1|2|4|8|16)\b/iu.exec(text)?.[1];
  if (!lanes) return undefined;
  const generation = /PCIe\s+(\d+)(?:\.\d+)?/iu.exec(text)?.[1];
  return {
    lanes: Number(lanes),
    ...(generation ? { generation: Number(generation) } : {}),
  };
}

function connectorRequirements(
  value: unknown,
): PowerConnectorRequirement[] | undefined {
  const connectors = object(value);
  if (!connectors) return undefined;
  const mappings = [
    ['pcie_6_pin', 'PCIE_6_PIN'],
    ['pcie_8_pin', 'PCIE_8_PIN'],
    ['pcie_12VHPWR', 'PCIE_12VHPWR'],
    ['pcie_12V_2x6', 'PCIE_12V_2X6'],
  ] as const;
  return mappings.flatMap(([source, type]) => {
    const count = positiveInteger(connectors[source]);
    return count ? [{ type, count, mode: 'REQUIRED' as const }] : [];
  });
}

function suppliedConnectors(value: unknown): PowerConnectorSpec[] | undefined {
  const connectors = object(value);
  if (!connectors) return undefined;
  const mappings = [
    ['atx_24_pin', 'ATX_24_PIN'],
    ['eps_8_pin', 'EPS_8_PIN'],
    ['pcie_12vhpwr', 'PCIE_12VHPWR'],
    ['pcie_6_plus_2_pin', 'PCIE_8_PIN'],
    ['sata', 'SATA_POWER'],
    ['molex_4_pin', 'MOLEX_4_PIN'],
  ] as const;
  return mappings.flatMap(([source, type]) => {
    const count = positiveInteger(connectors[source]);
    return count ? [{ type, count }] : [];
  });
}

function mapMotherboard(
  data: Readonly<Record<string, unknown>>,
  common: ReturnType<typeof metadata> & {},
): MappedBuildCoresPart | undefined {
  const socket = nonEmptyString(data.socket);
  const formFactor = motherboardFormFactor(data.form_factor);
  const memory = object(data.memory);
  const technology = memoryTechnology(memory?.ram_type);
  if (!socket || !formFactor || !technology) return undefined;
  const audit: ProviderFieldAudit[] = [
    directAudit('socket', 'spec.socket', socket, socket),
    directAudit('form_factor', 'spec.formFactor', data.form_factor as JsonValue, formFactor),
    directAudit('memory.ram_type', 'spec.memoryTechnologies', technology, [technology]),
  ];
  const maxMemoryGb = positiveInteger(memory?.max);
  const memorySlots = positiveInteger(memory?.slots);
  const chipset = nonEmptyString(data.chipset);
  const rgb = object(data.rgb_headers);
  const rgbHeaders = [
    { source: 'argb_5v', type: 'ARGB_5V_3_PIN' as const },
    { source: 'rgb_12v', type: 'RGB_12V_4_PIN' as const },
  ].flatMap(({ source, type }) => {
    const count = positiveInteger(rgb?.[source]);
    return count ? [{ type, count }] : [];
  });
  const usb = object(data.usb_headers);
  const usbHeaders = [
    { source: 'usb_2_0', type: 'USB_2_0' as const },
    { source: 'usb_3_2_gen_1', type: 'USB_3_2_GEN1' as const },
    { source: 'usb_3_2_gen_2', type: 'USB_3_2_GEN2_TYPE_E' as const },
    { source: 'usb_4', type: 'USB4' as const },
  ].flatMap(({ source, type }) => {
    const count = positiveInteger(usb?.[source]);
    return count ? [{ type, count }] : [];
  });
  const m2Slots = Array.isArray(data.m2_slots)
    ? data.m2_slots.flatMap((value, index) => {
        const slot = object(value);
        const key = slot?.key === 'M' || slot?.key === 'B' || slot?.key === 'E'
          ? slot.key
          : slot?.key === 'B+M' || slot?.key === 'B/M'
            ? 'B_M'
            : undefined;
        const formFactors = nonEmptyString(slot?.size)
          ?.match(/2230|2242|2260|2280|22110/gu)
          ?.map(Number)
          .filter((size): size is 2230 | 2242 | 2260 | 2280 | 22110 =>
            [2230, 2242, 2260, 2280, 22110].includes(size),
          ) ?? [];
        const sourceInterface = nonEmptyString(slot?.interface);
        const interfaces = [
          ...(sourceInterface?.toLocaleLowerCase('en-US').includes('pcie')
            ? ['PCIE_NVME' as const]
            : []),
          ...(sourceInterface?.toLocaleLowerCase('en-US').includes('sata')
            ? ['SATA' as const]
            : []),
        ];
        if (!key || formFactors.length === 0 || interfaces.length === 0) return [];
        const pcie = pcieInterface(sourceInterface);
        return [{
          slotId: `M2_${index + 1}`,
          key,
          formFactors: [...new Set(formFactors)],
          interfaces,
          ...(pcie?.generation ? { pcieGen: pcie.generation } : {}),
          ...(pcie?.lanes ? { lanes: pcie.lanes } : {}),
        }];
      })
    : [];
  const parsedIdentifiers = identifiers(data, common.partNumbers);
  return {
    category: 'MOTHERBOARD',
    manufacturer: common.manufacturer,
    model: common.name,
    ...(parsedIdentifiers.mpn ? { mpn: parsedIdentifiers.mpn } : {}),
    identifiers: parsedIdentifiers,
    spec: {
      socket,
      formFactor,
      memoryTechnologies: [technology],
      ...(chipset ? { chipset } : {}),
      ...(memorySlots ? { memorySlots } : {}),
      ...(maxMemoryGb ? { maxMemoryGb } : {}),
      ...(rgbHeaders.length ? { rgbHeaders } : {}),
      ...(usbHeaders.length ? { usbHeaders } : {}),
      ...(m2Slots.length ? { m2Slots } : {}),
    },
    criticalSpecs: { socket, formFactor, technology },
    audit,
  };
}

function mapGpu(
  data: Readonly<Record<string, unknown>>,
  common: ReturnType<typeof metadata> & {},
): MappedBuildCoresPart {
  const audit: ProviderFieldAudit[] = [];
  const length = positiveNumber(data.length);
  const normalizedLength = length === undefined
    ? undefined
    : unitAudit('length', 'spec.lengthMm', length, 'mm');
  if (normalizedLength) audit.push(normalizedLength.audit);
  const slotWidth = positiveNumber(data.total_slot_width);
  const link = pcieInterface(data.interface);
  const requirements = connectorRequirements(data.power_connectors);
  const parsedIdentifiers = identifiers(data, common.partNumbers);
  return {
    category: 'GPU',
    manufacturer: common.manufacturer,
    model: common.name,
    ...(parsedIdentifiers.mpn ? { mpn: parsedIdentifiers.mpn } : {}),
    identifiers: parsedIdentifiers,
    spec: {
      ...(normalizedLength ? { lengthMm: normalizedLength.value } : {}),
      ...(slotWidth ? { slotWidth } : {}),
      ...(link?.generation ? { pcieGeneration: link.generation } : {}),
      ...(link ? { maxLinkWidthLanes: link.lanes } : {}),
      ...(requirements === undefined
        ? {}
        : { powerConnectorRequirements: requirements }),
    },
    criticalSpecs: {
      ...(nonEmptyString(data.chipset) ? { chipset: nonEmptyString(data.chipset)! } : {}),
      ...(length ? { lengthMm: length } : {}),
    },
    audit,
  };
}

function mapCpuCooler(
  data: Readonly<Record<string, unknown>>,
  common: ReturnType<typeof metadata> & {},
): MappedBuildCoresPart | undefined {
  const sockets = Array.isArray(data.cpu_sockets)
    ? data.cpu_sockets.flatMap((value) => {
        const socket = nonEmptyString(value);
        return socket ? [socket] : [];
      })
    : [];
  const waterCooled = typeof data.water_cooled === 'boolean'
    ? data.water_cooled
    : undefined;
  const radiatorSizeMm = positiveInteger(data.radiator_size);
  const coolerType = waterCooled === false
    ? 'AIR'
    : waterCooled === true && radiatorSizeMm
      ? 'AIO'
      : undefined;
  if (!coolerType || sockets.length === 0) return undefined;
  const height = positiveNumber(data.height);
  const normalizedHeight = height === undefined
    ? undefined
    : unitAudit('height', 'spec.heightMm', height, 'mm');
  const parsedIdentifiers = identifiers(data, common.partNumbers);
  return {
    category: 'CPU_COOLER',
    manufacturer: common.manufacturer,
    model: common.name,
    ...(parsedIdentifiers.mpn ? { mpn: parsedIdentifiers.mpn } : {}),
    identifiers: parsedIdentifiers,
    spec: {
      coolerType,
      supportedSockets: sockets,
      ...(normalizedHeight ? { heightMm: normalizedHeight.value } : {}),
      ...(radiatorSizeMm ? { radiatorSizeMm } : {}),
    },
    criticalSpecs: { coolerType, supportedSockets: sockets.join('|') },
    audit: normalizedHeight ? [normalizedHeight.audit] : [],
  };
}

function mapPcCase(
  data: Readonly<Record<string, unknown>>,
  common: ReturnType<typeof metadata> & {},
): MappedBuildCoresPart | undefined {
  const supportedMotherboardFormFactors = Array.isArray(
    data.supported_motherboard_form_factors,
  )
    ? data.supported_motherboard_form_factors.flatMap((value) => {
        const formFactor = motherboardFormFactor(value);
        return formFactor ? [formFactor] : [];
      })
    : [];
  if (supportedMotherboardFormFactors.length === 0) return undefined;
  const supportedPsuFormFactors = Array.isArray(
    data.supported_power_supply_form_factors,
  )
    ? data.supported_power_supply_form_factors.flatMap((value) => {
        const formFactor = psuFormFactor(value);
        return formFactor ? [formFactor] : [];
      })
    : [];
  const measurementMappings = [
    ['max_video_card_length', 'maxGpuLengthMm'],
    ['max_cpu_cooler_height', 'maxCpuCoolerHeightMm'],
    ['max_psu_length', 'maxPsuLengthMm'],
  ] as const;
  const measurements = Object.fromEntries(
    measurementMappings.flatMap(([source, target]) => {
      const value = positiveNumber(data[source]);
      return value ? [[target, value]] : [];
    }),
  );
  const parsedIdentifiers = identifiers(data, common.partNumbers);
  const pcieSlotCount = positiveInteger(data.expansion_slots);
  return {
    category: 'PC_CASE',
    manufacturer: common.manufacturer,
    model: common.name,
    ...(parsedIdentifiers.mpn ? { mpn: parsedIdentifiers.mpn } : {}),
    identifiers: parsedIdentifiers,
    spec: {
      supportedMotherboardFormFactors: [...new Set(supportedMotherboardFormFactors)],
      ...(supportedPsuFormFactors.length
        ? { supportedPsuFormFactors: [...new Set(supportedPsuFormFactors)] }
        : {}),
      ...measurements,
      ...(pcieSlotCount ? { pcieSlotCount } : {}),
    },
    criticalSpecs: {
      supportedMotherboardFormFactors: supportedMotherboardFormFactors.join('|'),
    },
    audit: measurementMappings.flatMap(([source, target]) => {
      const value = positiveNumber(data[source]);
      return value ? [unitAudit(source, `spec.${target}`, value, 'mm').audit] : [];
    }),
  };
}

function mapPsu(
  data: Readonly<Record<string, unknown>>,
  common: ReturnType<typeof metadata> & {},
): MappedBuildCoresPart | undefined {
  const formFactor = psuFormFactor(data.form_factor);
  const wattage = positiveNumber(data.wattage);
  if (!formFactor || !wattage) return undefined;
  const ratedPower = unitAudit('wattage', 'spec.ratedPowerW', wattage, 'W');
  const length = positiveNumber(data.length);
  const normalizedLength = length === undefined
    ? undefined
    : unitAudit('length', 'spec.lengthMm', length, 'mm');
  const parsedIdentifiers = identifiers(data, common.partNumbers);
  const powerConnectors = suppliedConnectors(data.connectors);
  return {
    category: 'PSU',
    manufacturer: common.manufacturer,
    model: common.name,
    ...(parsedIdentifiers.mpn ? { mpn: parsedIdentifiers.mpn } : {}),
    identifiers: parsedIdentifiers,
    spec: {
      formFactor,
      ratedPowerW: ratedPower.value,
      ...(powerConnectors === undefined ? {} : { powerConnectors }),
      ...(normalizedLength ? { lengthMm: normalizedLength.value } : {}),
    },
    criticalSpecs: { formFactor, ratedPowerW: ratedPower.value },
    audit: [ratedPower.audit, ...(normalizedLength ? [normalizedLength.audit] : [])],
  };
}

function mapCaseFan(
  data: Readonly<Record<string, unknown>>,
  common: ReturnType<typeof metadata> & {},
): MappedBuildCoresPart | undefined {
  const diameterMm = positiveInteger(data.size);
  const sourceConnector = nonEmptyString(data.connector);
  const connector =
    data.pwm === true || /4[- ]?pin\s*pwm/iu.test(sourceConnector ?? '')
      ? ('PWM_4_PIN' as const)
      : data.pwm === false || /3[- ]?pin/iu.test(sourceConnector ?? '')
        ? ('DC_3_PIN' as const)
        : undefined;
  if (diameterMm === undefined || connector === undefined) return undefined;
  const diameter = unitAudit('size', 'spec.diameterMm', diameterMm, 'mm');
  const parsedIdentifiers = identifiers(data, common.partNumbers);
  return {
    category: 'CASE_FAN',
    manufacturer: common.manufacturer,
    model: common.name,
    ...(parsedIdentifiers.mpn ? { mpn: parsedIdentifiers.mpn } : {}),
    identifiers: parsedIdentifiers,
    spec: { diameterMm: diameter.value, connector },
    criticalSpecs: { diameterMm: diameter.value, connector },
    audit: [
      diameter.audit,
      directAudit(
        sourceConnector ? 'connector' : 'pwm',
        'spec.connector',
        (sourceConnector ?? data.pwm) as JsonValue,
        connector,
      ),
    ],
  };
}

function mapStorage(
  data: Readonly<Record<string, unknown>>,
  common: ReturnType<typeof metadata> & {},
): MappedBuildCoresPart | undefined {
  const capacityGb = positiveNumber(data.capacity);
  const sourceType = nonEmptyString(data.storage_type)?.toLocaleUpperCase('en-US');
  const sourceInterface = nonEmptyString(data.interface)?.toLocaleUpperCase('en-US');
  if (!capacityGb || !sourceType || !sourceInterface) return undefined;
  const isNvme = data.nvme === true || sourceInterface.includes('PCIE');
  const isSata = sourceInterface.includes('SATA');
  const storageType = sourceType === 'HDD' && isSata
    ? 'HDD'
    : sourceType === 'SSD' && isNvme
      ? 'NVME_SSD'
      : sourceType === 'SSD' && isSata
        ? 'SATA_SSD'
        : undefined;
  const canonicalInterface = isNvme ? 'PCIE_NVME' : isSata ? 'SATA' : undefined;
  if (!storageType || !canonicalInterface) return undefined;
  const formFactor = /M\.2[- ]?(2230|2242|2260|2280|22110)/iu.exec(
    nonEmptyString(data.form_factor) ?? '',
  )?.[1];
  const parsedIdentifiers = identifiers(data, common.partNumbers);
  return {
    category: 'STORAGE',
    manufacturer: common.manufacturer,
    model: common.name,
    ...(parsedIdentifiers.mpn ? { mpn: parsedIdentifiers.mpn } : {}),
    identifiers: parsedIdentifiers,
    spec: {
      storageType,
      capacityGb,
      interface: canonicalInterface,
      ...(formFactor ? { m2FormFactor: Number(formFactor) as 2230 | 2242 | 2260 | 2280 | 22110 } : {}),
    },
    criticalSpecs: { storageType, capacityGb, interface: canonicalInterface },
    audit: [],
  };
}

function mapRam(
  data: Readonly<Record<string, unknown>>,
  common: ReturnType<typeof metadata> & {},
): MappedBuildCoresPart | undefined {
  const technology = memoryTechnology(data.ram_type);
  const sourceFormFactor = nonEmptyString(data.form_factor);
  const modules = object(data.modules);
  const moduleCount = positiveInteger(modules?.quantity);
  const capacityPerModuleGb = positiveNumber(modules?.capacity_gb);
  if (!technology || !sourceFormFactor || !moduleCount || !capacityPerModuleGb) {
    return undefined;
  }
  const formFactor = sourceFormFactor.includes('SO-DIMM') ? 'SO_DIMM' : 'DIMM';
  const parsedIdentifiers = identifiers(data, common.partNumbers);
  const speed = positiveInteger(data.speed);
  const height = positiveNumber(data.height);
  const audit: ProviderFieldAudit[] = [];
  if (speed !== undefined) {
    audit.push({
      sourcePath: 'speed',
      targetPath: 'spec.dataRateMtps',
      rawValue: speed,
      rawUnit: 'MHz',
      canonicalValue: speed,
      canonicalUnit: 'MT/s',
      mappingKind: 'SOURCE_SEMANTIC_ALIAS',
      mappingRule: 'BUILDCORES_RAM_SPEED_MARKETED_DATA_RATE',
      mapperVersion: BUILDCORES_MAPPER_VERSION,
    });
  }
  const normalizedHeight = height === undefined
    ? undefined
    : unitAudit('height', 'spec.heightMm', height, 'mm');
  if (normalizedHeight) audit.push(normalizedHeight.audit);

  return {
    category: 'MEMORY',
    manufacturer: common.manufacturer,
    model: common.name,
    ...(parsedIdentifiers.mpn ? { mpn: parsedIdentifiers.mpn } : {}),
    identifiers: parsedIdentifiers,
    spec: {
      technology,
      formFactor,
      moduleCount,
      capacityPerModuleGb,
      ...(speed === undefined ? {} : { dataRateMtps: speed }),
      ...(normalizedHeight ? { heightMm: normalizedHeight.value } : {}),
    },
    criticalSpecs: {
      technology,
      formFactor,
      moduleCount,
      capacityPerModuleGb,
      ...(speed === undefined ? {} : { dataRateMtps: speed }),
    },
    audit,
  };
}

function mapCpu(
  data: Readonly<Record<string, unknown>>,
  common: ReturnType<typeof metadata> & {},
): MappedBuildCoresPart | undefined {
  const socket = nonEmptyString(data.socket);
  if (!socket) return undefined;
  const cores = object(data.cores);
  const specifications = object(data.specifications);
  const memory = object(specifications?.memory);
  const tdp = positiveNumber(specifications?.tdp);
  const peak = positiveNumber(specifications?.ppt);
  const supportedMemoryTechnologies = Array.isArray(memory?.types)
    ? memory.types.flatMap((value: unknown) => {
        const parsed = memoryTechnology(value);
        return parsed ? [parsed] : [];
      })
    : [];
  const audit: ProviderFieldAudit[] = [];
  const normalizedTdp = tdp === undefined
    ? undefined
    : unitAudit('specifications.tdp', 'spec.tdpW', tdp, 'W');
  const normalizedPeak = peak === undefined
    ? undefined
    : unitAudit('specifications.ppt', 'spec.peakPowerW', peak, 'W');
  if (normalizedTdp) audit.push(normalizedTdp.audit);
  if (normalizedPeak) audit.push(normalizedPeak.audit);
  const parsedIdentifiers = identifiers(data, common.partNumbers);

  return {
    category: 'CPU',
    manufacturer: common.manufacturer,
    model: common.name,
    ...(parsedIdentifiers.mpn ? { mpn: parsedIdentifiers.mpn } : {}),
    identifiers: parsedIdentifiers,
    spec: {
      socket,
      ...(positiveInteger(cores?.total) === undefined
        ? {}
        : { coreCount: positiveInteger(cores?.total) }),
      ...(positiveInteger(cores?.threads) === undefined
        ? {}
        : { threadCount: positiveInteger(cores?.threads) }),
      ...(normalizedTdp ? { tdpW: normalizedTdp.value } : {}),
      ...(normalizedPeak ? { peakPowerW: normalizedPeak.value } : {}),
      ...(supportedMemoryTechnologies.length === 0
        ? {}
        : { supportedMemoryTechnologies }),
    },
    criticalSpecs: { socket },
    audit,
  };
}

function mapRecord(record: BuildCoresSnapshotRecord):
  | { readonly status: 'FAILED'; readonly reason: string }
  | { readonly status: 'SKIPPED'; readonly reason: string }
  | { readonly status: 'MAPPED'; readonly value: MappedBuildCoresPart; readonly externalId: string } {
  if (record.parseError) return { status: 'FAILED', reason: 'INVALID_JSON' };
  const data = object(record.data);
  const externalId = nonEmptyString(data?.opendb_id);
  const common = data ? metadata(data) : undefined;
  if (!data || !externalId || !uuidV4.test(externalId) || !common) {
    return { status: 'FAILED', reason: 'INVALID_SOURCE_IDENTITY' };
  }
  const mapped = (() => {
    switch (record.category) {
      case 'CPU': return mapCpu(data, common);
      case 'Motherboard': return mapMotherboard(data, common);
      case 'RAM': return mapRam(data, common);
      case 'GPU': return mapGpu(data, common);
      case 'CPUCooler': return mapCpuCooler(data, common);
      case 'PCCase': return mapPcCase(data, common);
      case 'PSU': return mapPsu(data, common);
      case 'Storage': return mapStorage(data, common);
      case 'CaseFan': return mapCaseFan(data, common);
      default: return 'UNSUPPORTED';
    }
  })();
  if (mapped === 'UNSUPPORTED') {
    return { status: 'SKIPPED', reason: 'UNSUPPORTED_CATEGORY' };
  }
  return mapped
    ? { status: 'MAPPED', value: mapped, externalId }
    : { status: 'SKIPPED', reason: 'INSUFFICIENT_CANONICAL_FIELDS' };
}

function canonicalPart(mapped: MappedBuildCoresPart, partId: PartId): CanonicalPart {
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    partId,
    category: mapped.category,
    manufacturer: mapped.manufacturer,
    model: mapped.model,
    ...(mapped.mpn ? { mpn: mapped.mpn } : {}),
    status: 'ACTIVE',
    spec: mapped.spec,
  } as CanonicalPart;
}

function resultWithoutImport(
  record: BuildCoresSnapshotRecord,
  status: 'FAILED' | 'SKIPPED',
  reason: string,
): BuildCoresImportResult {
  return {
    status,
    category: record.category,
    sourcePath: record.relativePath,
    audit: [],
    reason,
  };
}

export function importBuildCoresSnapshot(
  options: ImportBuildCoresSnapshotOptions,
): BuildCoresImportReport {
  const results = options.snapshot.records.map<BuildCoresImportResult>((record) => {
    const mapped = mapRecord(record);
    if (mapped.status !== 'MAPPED') {
      return resultWithoutImport(record, mapped.status, mapped.reason);
    }
    const identity = resolveCanonicalIdentity({
      incoming: {
        source: BUILDCORES_PROVIDER_ID,
        externalId: mapped.externalId,
        category: mapped.value.category,
        manufacturer: mapped.value.manufacturer,
        model: mapped.value.model,
        rawName: mapped.value.model,
        identifiers: mapped.value.identifiers,
        criticalSpecs: mapped.value.criticalSpecs,
      },
      mappings: options.existingMappings,
      canonicalIdentities: options.canonicalIdentities,
      createPartId: options.createPartId,
      matchedAt: options.importedAt,
      mapperVersion: IDENTITY_MAPPER_VERSION,
    });
    if (identity.outcome === 'REJECTED') {
      return resultWithoutImport(record, 'FAILED', 'IDENTITY_CONFLICT');
    }
    if (identity.outcome === 'REVIEW_REQUIRED' || !identity.partId || !identity.mapping) {
      return resultWithoutImport(record, 'SKIPPED', 'IDENTITY_REVIEW_REQUIRED');
    }
    return {
      status: 'IMPORTED',
      externalId: mapped.externalId,
      category: record.category,
      sourcePath: record.relativePath,
      canonicalPart: canonicalPart(mapped.value, identity.partId),
      externalMapping: identity.mapping,
      audit: mapped.value.audit,
    };
  });

  return {
    providerVersion: options.snapshot.providerVersion,
    commitSha: options.snapshot.commitSha,
    schemaFingerprint: options.snapshot.schemaFingerprint,
    attribution: BUILDCORES_ATTRIBUTION,
    counts: {
      imported: results.filter((result) => result.status === 'IMPORTED').length,
      failed: results.filter((result) => result.status === 'FAILED').length,
      skipped: results.filter((result) => result.status === 'SKIPPED').length,
    },
    results,
  };
}
