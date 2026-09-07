import type { JsonValue } from '@pcpartcheck/core';

export interface ProviderAttribution {
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly attributionRequired: boolean;
  readonly notice: string;
}

export type ProviderMappingKind =
  | 'DIRECT'
  | 'UNIT_NORMALIZATION'
  | 'SOURCE_SEMANTIC_ALIAS';

export interface ProviderFieldAudit {
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly rawValue: JsonValue;
  readonly rawUnit?: string;
  readonly canonicalValue: JsonValue;
  readonly canonicalUnit?: string;
  readonly mappingKind: ProviderMappingKind;
  readonly mappingRule: string;
  readonly mapperVersion: string;
}

export interface TechnicalCatalogProvider<TSnapshot, TReport> {
  readonly providerId: string;
  readonly attribution: ProviderAttribution;
  importSnapshot(snapshot: TSnapshot): TReport;
}
