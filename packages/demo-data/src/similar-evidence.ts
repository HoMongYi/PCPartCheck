import type { InstallationContext } from '@pcpartcheck/core';
import type {
  FieldEvidenceRecord,
  FieldMeasurement,
} from '@pcpartcheck/evidence';

const queryContext: InstallationContext = {
  schemaVersion: '2.0.0',
  radiators: [
    {
      position: 'FRONT',
      sizeMm: 360,
      radiatorThicknessMm: 30,
      fanThicknessMm: 25,
    },
  ],
  hddCages: [],
  gpuOrientation: 'HORIZONTAL',
  occupiedPcieSlotIds: [],
  pciePower: {
    independentCableCount: 2,
    native12VhpwrCableCount: 0,
    native12V2x6CableCount: 0,
    adapterUsed: false,
  },
};

export const DEMO_SIMILARITY_QUERY = {
  issueType: 'PHYSICAL_CLEARANCE' as const,
  parts: [
    { category: 'GPU' as const, partId: '10000000-0000-4000-8000-000000000005' },
    { category: 'PC_CASE' as const, partId: '10000000-0000-4000-8000-000000000004' },
  ],
  installationContext: queryContext,
  measurements: [
    { fieldPath: 'gpu.lengthMm', value: 330, unit: 'mm' as const },
    { fieldPath: 'case.maxGpuLengthMm', value: 380, unit: 'mm' as const },
  ] satisfies readonly FieldMeasurement[],
};

function similarFailure(
  evidenceId: string,
  gpuPartId: string,
  gpuLengthMm: number,
  reportedAt: string,
): FieldEvidenceRecord {
  return {
    schemaVersion: '2.0.0',
    evidenceId,
    status: 'APPROVED',
    visibility: 'PUBLIC',
    redaction: 'NONE',
    outcome: 'ASSEMBLY_FAILURE',
    issueType: 'PHYSICAL_CLEARANCE',
    parts: [
      { category: 'GPU', partId: gpuPartId },
      { category: 'PC_CASE', partId: '10000000-0000-4000-8000-000000000004' },
    ],
    installationContext: queryContext,
    measurements: [
      { fieldPath: 'gpu.lengthMm', value: gpuLengthMm, unit: 'mm' },
      { fieldPath: 'case.maxGpuLengthMm', value: 380, unit: 'mm' },
    ],
    reportedAt,
  };
}

export const DEMO_EXACT_FIELD_EVIDENCE_RECORD: FieldEvidenceRecord = {
  schemaVersion: '2.0.0',
  evidenceId: 'demo-field-clearance-exact',
  status: 'APPROVED',
  visibility: 'PUBLIC',
  redaction: 'NONE',
  outcome: 'ASSEMBLY_FAILURE',
  issueType: 'PHYSICAL_CLEARANCE',
  parts: DEMO_SIMILARITY_QUERY.parts,
  installationContext: queryContext,
  measurements: DEMO_SIMILARITY_QUERY.measurements,
  reportedAt: '2026-08-05T00:00:00.000Z',
};

export const DEMO_FIELD_EVIDENCE_RECORDS: readonly FieldEvidenceRecord[] = [
  DEMO_EXACT_FIELD_EVIDENCE_RECORD,
  similarFailure(
    'demo-field-clearance-1',
    '20000000-0000-4000-8000-000000000001',
    332,
    '2026-08-01T00:00:00.000Z',
  ),
  similarFailure(
    'demo-field-clearance-2',
    '20000000-0000-4000-8000-000000000002',
    338,
    '2026-08-02T00:00:00.000Z',
  ),
  similarFailure(
    'demo-field-clearance-3',
    '20000000-0000-4000-8000-000000000003',
    345,
    '2026-08-03T00:00:00.000Z',
  ),
  similarFailure(
    'demo-field-clearance-4',
    '20000000-0000-4000-8000-000000000004',
    375,
    '2026-08-04T00:00:00.000Z',
  ),
];
