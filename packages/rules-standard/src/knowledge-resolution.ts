import {
  activeKnowledgeSnapshots,
  type BiosReleaseRelation,
  type BiosRequirement,
  type CompatibilityRuleContext,
  type ComponentRevision,
  type CpuSupportRelation,
  type KnowledgePartIdentity,
} from '@pcpartcheck/core';

import { partsOf } from './parts.js';

export interface CpuSupportObservation {
  readonly providerId: string;
  readonly snapshotId: string;
  readonly supportRelationId: string;
  readonly biosRequirement:
    | { readonly kind: 'NONE' }
    | { readonly kind: 'UNKNOWN' }
    | {
        readonly kind: 'MINIMUM';
        readonly biosReleaseId: string;
        readonly biosVersion: string;
      };
}

export type CpuSupportResolution =
  | {
      readonly kind: 'SUPPORTED';
      readonly relationIds: readonly string[];
      readonly observations: readonly CpuSupportObservation[];
    }
  | { readonly kind: 'UNSUPPORTED'; readonly relationIds: readonly string[] }
  | { readonly kind: 'MISSING' }
  | { readonly kind: 'CONFLICT'; readonly relationIds: readonly string[] };

interface ExplicitObservation {
  readonly providerId: string;
  readonly snapshotId: string;
  readonly relation: CpuSupportRelation;
  readonly biosRequirement?: CpuSupportObservation['biosRequirement'];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function matchesRevision(
  identity: KnowledgePartIdentity,
  componentRevisions: readonly ComponentRevision[],
): boolean {
  if (identity.hardwareRevision === undefined) {
    return true;
  }
  return componentRevisions.some(
    ({ partId, hardwareRevision }) =>
      partId === identity.partId &&
      hardwareRevision === identity.hardwareRevision,
  );
}

function resolveBiosRequirement(
  requirement: BiosRequirement,
  biosReleases: readonly BiosReleaseRelation[],
): CpuSupportObservation['biosRequirement'] {
  if (requirement.kind !== 'MINIMUM') {
    return { kind: requirement.kind };
  }
  const release = biosReleases.find(
    ({ relationId }) => relationId === requirement.biosReleaseId,
  );
  if (release === undefined) {
    throw new Error(
      `Validated Knowledge is missing BIOS release ${requirement.biosReleaseId}`,
    );
  }
  return {
    kind: 'MINIMUM',
    biosReleaseId: requirement.biosReleaseId,
    biosVersion: release.biosVersion,
  };
}

function relationIds(
  observations: readonly ExplicitObservation[],
): readonly string[] {
  return observations
    .map(({ relation }) => relation.relationId)
    .sort(compareText);
}

export function resolveCpuSupport(
  context: CompatibilityRuleContext,
): CpuSupportResolution {
  const cpus = partsOf(context.build.parts, 'CPU');
  const motherboards = partsOf(context.build.parts, 'MOTHERBOARD');
  const [cpu] = cpus;
  const [motherboard] = motherboards;
  if (
    cpus.length !== 1 ||
    motherboards.length !== 1 ||
    cpu === undefined ||
    motherboard === undefined
  ) {
    return { kind: 'MISSING' };
  }
  const componentRevisions =
    context.installationContext.componentRevisions ?? [];
  const observations: ExplicitObservation[] = [];

  for (const snapshot of activeKnowledgeSnapshots(context.knowledgeSnapshots)) {
    const biosReleases = snapshot.relations.filter(
      (relation): relation is BiosReleaseRelation =>
        relation.relationType === 'BIOS_RELEASE',
    );
    for (const relation of snapshot.relations) {
      if (
        relation.relationType !== 'CPU_SUPPORT' ||
        relation.subject.partId !== motherboard.partId ||
        relation.related.partId !== cpu.partId ||
        !matchesRevision(relation.subject, componentRevisions) ||
        !matchesRevision(relation.related, componentRevisions)
      ) {
        continue;
      }
      observations.push({
        providerId: snapshot.provider.providerId,
        snapshotId: snapshot.snapshotId,
        relation,
        ...(relation.support === 'SUPPORTED'
          ? {
              biosRequirement: resolveBiosRequirement(
                relation.biosRequirement,
                biosReleases,
              ),
            }
          : {}),
      });
    }
  }

  if (observations.length === 0) {
    return { kind: 'MISSING' };
  }

  const supported = observations.filter(
    ({ relation }) => relation.support === 'SUPPORTED',
  );
  const unsupported = observations.filter(
    ({ relation }) => relation.support === 'UNSUPPORTED',
  );
  if (supported.length > 0 && unsupported.length > 0) {
    return { kind: 'CONFLICT', relationIds: relationIds(observations) };
  }
  if (unsupported.length > 0) {
    return {
      kind: 'UNSUPPORTED',
      relationIds: relationIds(unsupported),
    };
  }

  return {
    kind: 'SUPPORTED',
    relationIds: relationIds(supported),
    observations: supported
      .map(({ providerId, snapshotId, relation, biosRequirement }) => ({
        providerId,
        snapshotId,
        supportRelationId: relation.relationId,
        biosRequirement: biosRequirement!,
      }))
      .sort(
        (left, right) =>
          compareText(left.providerId, right.providerId) ||
          compareText(left.snapshotId, right.snapshotId) ||
          compareText(left.supportRelationId, right.supportRelationId),
      ),
  };
}
