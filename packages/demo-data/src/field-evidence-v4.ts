import type { FieldEvidenceSnapshot } from '@pcpartcheck/evidence';

import { DEMO_EXACT_FIELD_EVIDENCE_RECORD } from './similar-evidence.js';

export const EMPTY_FIELD_EVIDENCE_SNAPSHOT: FieldEvidenceSnapshot = {
  fieldEvidenceSchemaVersion: '4.0.0',
  evidencePolicyVersion: '1.0.0',
  records: [],
};

export const SYNTHETIC_EXACT_FIELD_EVIDENCE_SNAPSHOT: FieldEvidenceSnapshot = {
  fieldEvidenceSchemaVersion: '4.0.0',
  evidencePolicyVersion: '1.0.0',
  records: [DEMO_EXACT_FIELD_EVIDENCE_RECORD],
};
