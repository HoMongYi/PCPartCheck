import type { CanonicalPart, JsonValue, PartCategory, PartId } from '@pcpartcheck/core';
import type { CanonicalIdentity, ExternalMapping } from '@pcpartcheck/identity';
import type { ProviderAttribution, ProviderFieldAudit } from '@pcpartcheck/provider-sdk';

export const BUILDCORES_PROVIDER_ID = 'buildcores-open-db' as const;
export const BUILDCORES_MAPPER_VERSION = '3.0.0' as const;
export const BUILDCORES_SUPPORTED_CATEGORIES = [
  'CPU',
  'CPUCooler',
  'CaseFan',
  'GPU',
  'Motherboard',
  'PCCase',
  'PSU',
  'RAM',
  'Storage',
] as const;

export const BUILDCORES_ATTRIBUTION: ProviderAttribution = {
  sourceName: 'BuildCores OpenDB',
  sourceUrl: 'https://github.com/buildcores/buildcores-open-db',
  license: 'ODC-By-1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/by/1-0/',
  attributionRequired: true,
  notice:
    'BuildCores OpenDB data is provided under the Open Data Commons Attribution License v1.0.',
};

export interface BuildCoresSnapshotRecord {
  readonly category: string;
  readonly relativePath: string;
  readonly data?: JsonValue;
  readonly parseError?: string;
  readonly sourceSchemaValidation?: {
    readonly valid: boolean;
    readonly errors: readonly string[];
  };
}

export interface BuildCoresSnapshot {
  readonly providerId: typeof BUILDCORES_PROVIDER_ID;
  readonly providerVersion: string;
  readonly commitSha: string;
  readonly schemaFingerprint: string;
  readonly records: readonly BuildCoresSnapshotRecord[];
}

export interface LoadBuildCoresSnapshotOptions {
  readonly rootDir: string;
  readonly commitSha: string;
  readonly schemaFingerprint: string;
  readonly categories?: readonly string[];
}

export class BuildCoresSchemaFingerprintMismatchError extends Error {
  readonly code = 'BUILDCORES_SCHEMA_FINGERPRINT_MISMATCH';

  constructor(
    readonly expectedFingerprint: string,
    readonly actualFingerprint: string,
  ) {
    super(
      `BuildCores schema fingerprint mismatch: expected ${expectedFingerprint}, received ${actualFingerprint}`,
    );
    this.name = 'BuildCoresSchemaFingerprintMismatchError';
  }
}

export type BuildCoresImportStatus = 'IMPORTED' | 'FAILED' | 'SKIPPED';

export interface BuildCoresImportResult {
  readonly status: BuildCoresImportStatus;
  readonly externalId?: string;
  readonly category: string;
  readonly sourcePath: string;
  readonly canonicalPart?: CanonicalPart;
  readonly externalMapping?: ExternalMapping;
  readonly audit: readonly ProviderFieldAudit[];
  readonly reason?: string;
}

export interface BuildCoresImportReport {
  readonly providerVersion: string;
  readonly commitSha: string;
  readonly schemaFingerprint: string;
  readonly attribution: ProviderAttribution;
  readonly counts: {
    readonly imported: number;
    readonly failed: number;
    readonly skipped: number;
  };
  readonly results: readonly BuildCoresImportResult[];
}

export interface ImportBuildCoresSnapshotOptions {
  readonly snapshot: BuildCoresSnapshot;
  readonly existingMappings: readonly ExternalMapping[];
  readonly canonicalIdentities: readonly CanonicalIdentity[];
  readonly createPartId: () => PartId;
  readonly importedAt: string;
}

export interface MappedBuildCoresPart {
  readonly category: PartCategory;
  readonly manufacturer: string;
  readonly model: string;
  readonly mpn?: string;
  readonly spec: CanonicalPart['spec'];
  readonly criticalSpecs: Readonly<Record<string, boolean | null | number | string>>;
  readonly identifiers: {
    readonly mpn?: string;
    readonly gtin?: string;
    readonly ean?: string;
    readonly upc?: string;
  };
  readonly audit: readonly ProviderFieldAudit[];
}
