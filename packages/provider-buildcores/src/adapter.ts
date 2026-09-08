import type {
  CanonicalPart,
  MemoryTechnology,
  PartId,
} from '@pcpartcheck/core';
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
  if (record.category !== 'CPU' && record.category !== 'RAM') {
    return { status: 'SKIPPED', reason: 'UNSUPPORTED_CATEGORY' };
  }
  const data = object(record.data);
  const externalId = nonEmptyString(data?.opendb_id);
  const common = data ? metadata(data) : undefined;
  if (!data || !externalId || !uuidV4.test(externalId) || !common) {
    return { status: 'FAILED', reason: 'INVALID_SOURCE_IDENTITY' };
  }
  const mapped = record.category === 'RAM' ? mapRam(data, common) : mapCpu(data, common);
  return mapped
    ? { status: 'MAPPED', value: mapped, externalId }
    : { status: 'SKIPPED', reason: 'INSUFFICIENT_CANONICAL_FIELDS' };
}

function canonicalPart(mapped: MappedBuildCoresPart, partId: PartId): CanonicalPart {
  return {
    schemaVersion: '2.0.0',
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
