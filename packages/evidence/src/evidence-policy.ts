import type { PartCategory } from '@pcpartcheck/core';
import { Type, type Static } from '@sinclair/typebox';

export const FIELD_EVIDENCE_POLICY_VERSION = '1.0.0' as const;

export const MaterialContextFieldSchema = Type.Union([
  Type.Literal('radiators'),
  Type.Literal('hddCages'),
  Type.Literal('gpuOrientation'),
  Type.Literal('occupiedPcieSlotIds'),
  Type.Literal('pciePower'),
  Type.Literal('installedBiosVersion'),
  Type.Literal('componentRevisions'),
]);
export type MaterialContextField = Static<typeof MaterialContextFieldSchema>;

const PartCategorySchema = Type.Union([
  Type.Literal('CPU'),
  Type.Literal('CPU_COOLER'),
  Type.Literal('GPU'),
  Type.Literal('MOTHERBOARD'),
  Type.Literal('PC_CASE'),
  Type.Literal('PSU'),
  Type.Literal('MEMORY'),
  Type.Literal('STORAGE'),
  Type.Literal('CASE_FAN'),
  Type.Literal('PCIE_CARD'),
]);

export const ExactEvidenceScopeSchema = Type.Object(
  {
    requiredPartCategories: Type.Array(PartCategorySchema, {
      minItems: 1,
      uniqueItems: true,
    }),
    requiredContextFields: Type.Array(MaterialContextFieldSchema, {
      minItems: 2,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);
export type ExactEvidenceScope = Static<typeof ExactEvidenceScopeSchema>;

type ExactEvidenceIssueType =
  | 'PHYSICAL_CLEARANCE'
  | 'RADIATOR_CLEARANCE'
  | 'MEMORY_CLEARANCE'
  | 'POWER_CONNECTOR'
  | 'BIOS_POST'
  | 'STORAGE_RESOURCE'
  | 'THERMAL';

const GLOBAL_CONTEXT_FIELDS = [
  'componentRevisions',
  'installedBiosVersion',
] as const satisfies readonly MaterialContextField[];

const ISSUE_CONTEXT_FIELDS: Readonly<
  Record<ExactEvidenceIssueType, readonly MaterialContextField[]>
> = {
  PHYSICAL_CLEARANCE: ['radiators', 'hddCages', 'gpuOrientation'],
  RADIATOR_CLEARANCE: ['radiators', 'hddCages'],
  MEMORY_CLEARANCE: [],
  POWER_CONNECTOR: ['pciePower'],
  BIOS_POST: [],
  STORAGE_RESOURCE: ['occupiedPcieSlotIds'],
  THERMAL: [],
};

export class InvalidExactEvidenceScopeError extends Error {
  readonly code = 'INVALID_EXACT_EVIDENCE_SCOPE';

  constructor(message: string) {
    super(`Invalid exact evidence scope: ${message}`);
    this.name = 'InvalidExactEvidenceScopeError';
  }
}

function orderedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function requiredContextFieldsForIssue(
  issueType: ExactEvidenceIssueType,
): readonly MaterialContextField[] {
  return orderedUnique([
    ...GLOBAL_CONTEXT_FIELDS,
    ...ISSUE_CONTEXT_FIELDS[issueType],
  ]) as readonly MaterialContextField[];
}

export function isAutomaticExactIssue(issueType: ExactEvidenceIssueType): boolean {
  return issueType !== 'THERMAL';
}

export function assertValidExactEvidenceScope(
  issueType: ExactEvidenceIssueType,
  parts: readonly { readonly category: PartCategory }[],
  scope: ExactEvidenceScope,
): void {
  const actualCategories = orderedUnique(parts.map(({ category }) => category));
  const declaredCategories = orderedUnique(scope.requiredPartCategories);
  if (JSON.stringify(actualCategories) !== JSON.stringify(declaredCategories)) {
    throw new InvalidExactEvidenceScopeError(
      'requiredPartCategories must equal the complete record category set',
    );
  }

  const declaredFields = new Set(scope.requiredContextFields);
  for (const requiredField of requiredContextFieldsForIssue(issueType)) {
    if (!declaredFields.has(requiredField)) {
      throw new InvalidExactEvidenceScopeError(
        `requiredContextFields omits ${requiredField}`,
      );
    }
  }
}
