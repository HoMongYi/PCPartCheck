import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

import { PartIdSchema } from './canonical/primitives.js';

export const KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION = '1.0.0' as const;

const NonEmptyStringSchema = Type.String({ minLength: 1 });

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

export const KnowledgeProviderReferenceSchema = Type.Object(
  {
    providerId: NonEmptyStringSchema,
    providerVersion: NonEmptyStringSchema,
    dataRevision: Type.Optional(NonEmptyStringSchema),
    schemaFingerprint: Type.Optional(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);
export type KnowledgeProviderReference = DeepReadonly<Static<
  typeof KnowledgeProviderReferenceSchema
>>;

export const KnowledgeSourceReferenceSchema = Type.Object(
  {
    sourceId: NonEmptyStringSchema,
    sourceUri: Type.Optional(NonEmptyStringSchema),
    capturedAt: NonEmptyStringSchema,
    contentHash: Type.Optional(
      Type.String({ pattern: '^sha256:.+$' }),
    ),
    evidenceIds: Type.Array(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);
export type KnowledgeSourceReference = DeepReadonly<Static<
  typeof KnowledgeSourceReferenceSchema
>>;

export const KnowledgePartIdentitySchema = Type.Object(
  {
    partId: PartIdSchema,
    category: Type.Union([
      Type.Literal('CPU'),
      Type.Literal('MOTHERBOARD'),
    ]),
    hardwareRevision: Type.Optional(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);
export type KnowledgePartIdentity = DeepReadonly<Static<
  typeof KnowledgePartIdentitySchema
>>;

export const MotherboardKnowledgePartIdentitySchema = Type.Object(
  {
    partId: PartIdSchema,
    category: Type.Literal('MOTHERBOARD'),
    hardwareRevision: Type.Optional(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);
export type MotherboardKnowledgePartIdentity = DeepReadonly<Static<
  typeof MotherboardKnowledgePartIdentitySchema
>>;

export const CpuKnowledgePartIdentitySchema = Type.Object(
  {
    partId: PartIdSchema,
    category: Type.Literal('CPU'),
    hardwareRevision: Type.Optional(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);
export type CpuKnowledgePartIdentity = DeepReadonly<Static<
  typeof CpuKnowledgePartIdentitySchema
>>;

export const BiosRequirementSchema = Type.Union([
  Type.Object(
    { kind: Type.Literal('NONE') },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('UNKNOWN') },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal('MINIMUM'),
      biosReleaseId: NonEmptyStringSchema,
    },
    { additionalProperties: false },
  ),
]);
export type BiosRequirement = DeepReadonly<
  Static<typeof BiosRequirementSchema>
>;

export const BiosReleaseRelationSchema = Type.Object(
  {
    relationId: NonEmptyStringSchema,
    relationType: Type.Literal('BIOS_RELEASE'),
    subject: MotherboardKnowledgePartIdentitySchema,
    biosVersion: NonEmptyStringSchema,
    releaseOrdinal: Type.Number({ minimum: 0 }),
    releasedAt: Type.Optional(NonEmptyStringSchema),
    sourceIds: Type.Array(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);
export type BiosReleaseRelation = DeepReadonly<Static<
  typeof BiosReleaseRelationSchema
>>;

const UnsupportedCpuSupportRelationSchema = Type.Object(
  {
    relationId: NonEmptyStringSchema,
    relationType: Type.Literal('CPU_SUPPORT'),
    subject: MotherboardKnowledgePartIdentitySchema,
    related: CpuKnowledgePartIdentitySchema,
    support: Type.Literal('UNSUPPORTED'),
    sourceIds: Type.Array(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);

const SupportedCpuSupportRelationSchema = Type.Object(
  {
    relationId: NonEmptyStringSchema,
    relationType: Type.Literal('CPU_SUPPORT'),
    subject: MotherboardKnowledgePartIdentitySchema,
    related: CpuKnowledgePartIdentitySchema,
    support: Type.Literal('SUPPORTED'),
    biosRequirement: BiosRequirementSchema,
    sourceIds: Type.Array(NonEmptyStringSchema),
  },
  { additionalProperties: false },
);

export const CpuSupportRelationSchema = Type.Union([
  UnsupportedCpuSupportRelationSchema,
  SupportedCpuSupportRelationSchema,
]);
export type CpuSupportRelation = DeepReadonly<Static<
  typeof CpuSupportRelationSchema
>>;

export const KnowledgeRelationSchema = Type.Union([
  CpuSupportRelationSchema,
  BiosReleaseRelationSchema,
]);
export type KnowledgeRelation = DeepReadonly<
  Static<typeof KnowledgeRelationSchema>
>;

export const KnowledgeSnapshotSchema = Type.Object(
  {
    schemaVersion: Type.Literal(KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION),
    snapshotId: NonEmptyStringSchema,
    supersedesSnapshotId: Type.Optional(NonEmptyStringSchema),
    provider: KnowledgeProviderReferenceSchema,
    collectedAt: NonEmptyStringSchema,
    sources: Type.Array(KnowledgeSourceReferenceSchema),
    relations: Type.Array(KnowledgeRelationSchema),
  },
  { additionalProperties: false },
);
export type KnowledgeSnapshot = DeepReadonly<
  Static<typeof KnowledgeSnapshotSchema>
>;

export class InvalidKnowledgeSnapshotError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidKnowledgeSnapshotError';
  }
}

function compareIds(
  left: { readonly [key: string]: unknown },
  right: { readonly [key: string]: unknown },
  key: string,
): number {
  const leftId = left[key] as string;
  const rightId = right[key] as string;
  if (leftId < rightId) {
    return -1;
  }
  return leftId > rightId ? 1 : 0;
}

function sameMotherboardCondition(
  left: MotherboardKnowledgePartIdentity,
  right: MotherboardKnowledgePartIdentity,
): boolean {
  return (
    left.partId === right.partId &&
    left.hardwareRevision === right.hardwareRevision
  );
}

function validateSnapshotContents(
  snapshots: readonly KnowledgeSnapshot[],
): void {
  const relationIds = new Set<string>();

  for (const snapshot of snapshots) {
    const sourceIds = new Set<string>();
    for (const source of snapshot.sources) {
      if (sourceIds.has(source.sourceId)) {
        throw new InvalidKnowledgeSnapshotError(
          `Duplicate knowledge sourceId: ${source.sourceId}`,
        );
      }
      sourceIds.add(source.sourceId);
      if (
        source.sourceUri === undefined &&
        source.contentHash === undefined &&
        source.evidenceIds.length === 0
      ) {
        throw new InvalidKnowledgeSnapshotError(
          `Knowledge source ${source.sourceId} has no durable provenance locator`,
        );
      }
    }

    for (const relation of snapshot.relations) {
      if (relationIds.has(relation.relationId)) {
        throw new InvalidKnowledgeSnapshotError(
          `Duplicate knowledge relationId: ${relation.relationId}`,
        );
      }
      relationIds.add(relation.relationId);
      if (relation.sourceIds.length === 0) {
        throw new InvalidKnowledgeSnapshotError(
          `Knowledge relation ${relation.relationId} has no sourceIds`,
        );
      }
      for (const sourceId of relation.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          throw new InvalidKnowledgeSnapshotError(
            `Unknown knowledge sourceId: ${sourceId}`,
          );
        }
      }
    }

    const biosReleases = new Map(
      snapshot.relations
        .filter(
          (relation): relation is BiosReleaseRelation =>
            relation.relationType === 'BIOS_RELEASE',
        )
        .map((relation) => [relation.relationId, relation]),
    );
    for (const relation of snapshot.relations) {
      if (
        relation.relationType !== 'CPU_SUPPORT' ||
        relation.support !== 'SUPPORTED' ||
        relation.biosRequirement.kind !== 'MINIMUM'
      ) {
        continue;
      }
      const biosRelease = biosReleases.get(
        relation.biosRequirement.biosReleaseId,
      );
      if (biosRelease === undefined) {
        throw new InvalidKnowledgeSnapshotError(
          `Unknown minimum BIOS releaseId: ${relation.biosRequirement.biosReleaseId}`,
        );
      }
      if (!sameMotherboardCondition(relation.subject, biosRelease.subject)) {
        throw new InvalidKnowledgeSnapshotError(
          `Minimum BIOS motherboard identity mismatch: ${relation.relationId}`,
        );
      }
    }
  }
}

function validateSupersession(
  snapshots: readonly KnowledgeSnapshot[],
  snapshotsById: ReadonlyMap<string, KnowledgeSnapshot>,
): void {
  for (const snapshot of snapshots) {
    const supersededId = snapshot.supersedesSnapshotId;
    if (supersededId === undefined) {
      continue;
    }
    if (supersededId === snapshot.snapshotId) {
      throw new InvalidKnowledgeSnapshotError(
        `Knowledge snapshot cannot supersede itself: ${snapshot.snapshotId}`,
      );
    }
    const superseded = snapshotsById.get(supersededId);
    if (superseded === undefined) {
      throw new InvalidKnowledgeSnapshotError(
        `Unknown supersedesSnapshotId: ${supersededId}`,
      );
    }
    if (snapshot.provider.providerId !== superseded.provider.providerId) {
      throw new InvalidKnowledgeSnapshotError(
        `Knowledge supersession provider mismatch: ${snapshot.snapshotId}`,
      );
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (snapshotId: string): void => {
    if (visiting.has(snapshotId)) {
      throw new InvalidKnowledgeSnapshotError(
        `Knowledge supersession cycle: ${snapshotId}`,
      );
    }
    if (visited.has(snapshotId)) {
      return;
    }
    visiting.add(snapshotId);
    const supersededId = snapshotsById.get(snapshotId)?.supersedesSnapshotId;
    if (supersededId !== undefined) {
      visit(supersededId);
    }
    visiting.delete(snapshotId);
    visited.add(snapshotId);
  };

  for (const snapshot of snapshots) {
    visit(snapshot.snapshotId);
  }
}

export function validateAndCanonicalizeKnowledgeSnapshots(
  snapshots: readonly KnowledgeSnapshot[],
): readonly KnowledgeSnapshot[] {
  if (!Array.isArray(snapshots)) {
    throw new InvalidKnowledgeSnapshotError(
      'Knowledge snapshots must be an array',
    );
  }

  const snapshotsById = new Map<string, KnowledgeSnapshot>();
  const validated = snapshots.map((snapshot, index) => {
    if (!Value.Check(KnowledgeSnapshotSchema, snapshot)) {
      throw new InvalidKnowledgeSnapshotError(
        `Invalid knowledge snapshot at index ${index}`,
      );
    }
    const cloned = structuredClone(snapshot) as KnowledgeSnapshot;
    if (snapshotsById.has(cloned.snapshotId)) {
      throw new InvalidKnowledgeSnapshotError(
        `Duplicate knowledge snapshotId: ${cloned.snapshotId}`,
      );
    }
    snapshotsById.set(cloned.snapshotId, cloned);
    return cloned;
  });

  validateSnapshotContents(validated);
  validateSupersession(validated, snapshotsById);

  return validated
    .map((snapshot) => ({
      ...snapshot,
      sources: [...snapshot.sources].sort((left, right) =>
        compareIds(left, right, 'sourceId'),
      ),
      relations: [...snapshot.relations].sort((left, right) =>
        compareIds(left, right, 'relationId'),
      ),
    }))
    .sort((left, right) => compareIds(left, right, 'snapshotId'));
}

export function activeKnowledgeSnapshots(
  snapshots: readonly KnowledgeSnapshot[],
): readonly KnowledgeSnapshot[] {
  const canonical = validateAndCanonicalizeKnowledgeSnapshots(snapshots);
  const supersededIds = new Set(
    canonical.flatMap(({ supersedesSnapshotId }) =>
      supersedesSnapshotId === undefined ? [] : [supersedesSnapshotId],
    ),
  );
  return canonical.filter(
    ({ snapshotId }) => !supersededIds.has(snapshotId),
  );
}
