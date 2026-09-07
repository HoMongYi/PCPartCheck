import type { JsonValue } from '@pcpartcheck/core';

export type EvidenceRole =
  | 'TECHNICAL_SPEC'
  | 'RETAIL_IDENTITY'
  | 'FIELD_EVIDENCE';

export interface EvidenceSource {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly sourceUri?: string;
  readonly license?: string;
  readonly attributionRequired?: boolean;
}

export interface RawFieldEvidence {
  readonly evidenceId: string;
  readonly role: EvidenceRole;
  readonly source: EvidenceSource;
  readonly capturedAt: string;
  readonly fieldPath: string;
  readonly rawValue: JsonValue;
  readonly rawUnit?: string;
}
