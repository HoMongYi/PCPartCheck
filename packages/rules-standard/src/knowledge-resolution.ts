import {
  activeKnowledgeSnapshots,
  type BiosReleaseRelation,
  type BiosRequirement,
  type CompatibilityRuleContext,
  type ComponentRevision,
  type CpuSupportRelation,
  type KnowledgePartIdentity,
  type KnowledgeSnapshot,
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

export type BiosRequirementResolution =
  | { readonly kind: 'NOT_APPLICABLE'; readonly relationIds: readonly string[] }
  | { readonly kind: 'NONE'; readonly relationIds: readonly string[] }
  | { readonly kind: 'UNKNOWN'; readonly relationIds: readonly string[] }
  | { readonly kind: 'SATISFIED'; readonly relationIds: readonly string[] }
  | { readonly kind: 'INSUFFICIENT'; readonly relationIds: readonly string[] }
  | { readonly kind: 'AMBIGUOUS'; readonly relationIds: readonly string[] };

interface ExplicitObservation {
  readonly providerId: string;
  readonly snapshotId: string;
  readonly relation: CpuSupportRelation;
  readonly biosRequirement?: CpuSupportObservation['biosRequirement'];
}

interface ProviderBiosOutcome {
  readonly requirementKind: 'NONE' | 'UNKNOWN' | 'MINIMUM';
  readonly comparison?:
    | 'UNKNOWN'
    | 'SATISFIED'
    | 'INSUFFICIENT'
    | 'AMBIGUOUS';
  readonly requiredBiosVersion?: string;
  readonly relationIds: readonly string[];
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

function resolveCpuBiosRequirement(
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

function sameMotherboardCondition(
  left: KnowledgePartIdentity,
  right: KnowledgePartIdentity,
): boolean {
  return (
    left.partId === right.partId &&
    left.hardwareRevision === right.hardwareRevision
  );
}

function sortedUniqueRelationIds(
  groups: readonly (readonly string[])[],
): readonly string[] {
  return [...new Set(groups.flat())].sort(compareText);
}

function evaluateProviderBios(
  context: CompatibilityRuleContext,
  activeSnapshots: readonly KnowledgeSnapshot[],
  observation: CpuSupportObservation,
): ProviderBiosOutcome {
  const supportRelationIds = [observation.supportRelationId];
  const requirement = observation.biosRequirement;
  if (requirement.kind === 'NONE') {
    return {
      requirementKind: 'NONE',
      relationIds: supportRelationIds,
    };
  }
  if (requirement.kind === 'UNKNOWN') {
    return {
      requirementKind: 'UNKNOWN',
      relationIds: supportRelationIds,
    };
  }

  const snapshot = activeSnapshots.find(
    ({ snapshotId }) => snapshotId === observation.snapshotId,
  );
  if (snapshot === undefined) {
    return {
      requirementKind: 'MINIMUM',
      comparison: 'UNKNOWN',
      requiredBiosVersion: requirement.biosVersion,
      relationIds: supportRelationIds,
    };
  }
  const minimumReleases =
    snapshot.relations.filter(
      (relation): relation is BiosReleaseRelation =>
        relation.relationType === 'BIOS_RELEASE' &&
        relation.relationId === requirement.biosReleaseId,
    );
  const minimumRelationIds = minimumReleases.map(
    ({ relationId }) => relationId,
  );
  const minimumRelease = minimumReleases[0];
  if (minimumReleases.length !== 1 || minimumRelease === undefined) {
    return {
      requirementKind: 'MINIMUM',
      comparison: 'UNKNOWN',
      requiredBiosVersion: requirement.biosVersion,
      relationIds: sortedUniqueRelationIds([
        supportRelationIds,
        minimumRelationIds,
      ]),
    };
  }

  const baseRelationIds = [
    observation.supportRelationId,
    minimumRelease.relationId,
  ];
  const installedBiosVersion =
    context.installationContext.installedBiosVersion;
  if (installedBiosVersion === undefined) {
    return {
      requirementKind: 'MINIMUM',
      comparison: 'UNKNOWN',
      requiredBiosVersion: minimumRelease.biosVersion,
      relationIds: sortedUniqueRelationIds([baseRelationIds]),
    };
  }

  const installedReleases = snapshot.relations.filter(
    (relation): relation is BiosReleaseRelation =>
      relation.relationType === 'BIOS_RELEASE' &&
      relation.biosVersion === installedBiosVersion &&
      sameMotherboardCondition(relation.subject, minimumRelease.subject),
  );
  const relationIds = sortedUniqueRelationIds([
    baseRelationIds,
    installedReleases.map(({ relationId }) => relationId),
  ]);
  if (installedReleases.length !== 1) {
    return {
      requirementKind: 'MINIMUM',
      comparison: 'AMBIGUOUS',
      requiredBiosVersion: minimumRelease.biosVersion,
      relationIds,
    };
  }

  const installedRelease = installedReleases[0];
  if (installedRelease === undefined) {
    return {
      requirementKind: 'MINIMUM',
      comparison: 'AMBIGUOUS',
      requiredBiosVersion: minimumRelease.biosVersion,
      relationIds,
    };
  }
  return {
    requirementKind: 'MINIMUM',
    comparison:
      installedRelease.releaseOrdinal >= minimumRelease.releaseOrdinal
        ? 'SATISFIED'
        : 'INSUFFICIENT',
    requiredBiosVersion: minimumRelease.biosVersion,
    relationIds,
  };
}

function combineProviderBiosOutcomes(
  outcomes: readonly ProviderBiosOutcome[],
): BiosRequirementResolution {
  const relationIds = sortedUniqueRelationIds(
    outcomes.map((outcome) => outcome.relationIds),
  );
  const requirementKinds = new Set(
    outcomes.map(({ requirementKind }) => requirementKind),
  );
  if (requirementKinds.size !== 1) {
    return { kind: 'AMBIGUOUS', relationIds };
  }

  const requirementKind = outcomes[0]?.requirementKind;
  if (requirementKind === 'NONE') {
    return { kind: 'NONE', relationIds };
  }
  if (requirementKind === 'UNKNOWN' || requirementKind === undefined) {
    return { kind: 'UNKNOWN', relationIds };
  }

  const requiredVersions = new Set(
    outcomes.map(({ requiredBiosVersion }) => requiredBiosVersion),
  );
  const comparisons = new Set(outcomes.map(({ comparison }) => comparison));
  if (
    requiredVersions.size !== 1 ||
    comparisons.size !== 1 ||
    comparisons.has('AMBIGUOUS')
  ) {
    return { kind: 'AMBIGUOUS', relationIds };
  }

  const comparison = outcomes[0]?.comparison;
  switch (comparison) {
    case 'SATISFIED':
      return { kind: 'SATISFIED', relationIds };
    case 'INSUFFICIENT':
      return { kind: 'INSUFFICIENT', relationIds };
    case 'UNKNOWN':
    case undefined:
      return { kind: 'UNKNOWN', relationIds };
    case 'AMBIGUOUS':
      return { kind: 'AMBIGUOUS', relationIds };
  }
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
              biosRequirement: resolveCpuBiosRequirement(
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

export function resolveBiosRequirement(
  context: CompatibilityRuleContext,
): BiosRequirementResolution {
  const cpuSupport = resolveCpuSupport(context);
  switch (cpuSupport.kind) {
    case 'UNSUPPORTED':
      return {
        kind: 'NOT_APPLICABLE',
        relationIds: cpuSupport.relationIds,
      };
    case 'MISSING':
      return { kind: 'UNKNOWN', relationIds: [] };
    case 'CONFLICT':
      return { kind: 'AMBIGUOUS', relationIds: cpuSupport.relationIds };
    case 'SUPPORTED': {
      const activeSnapshots = activeKnowledgeSnapshots(
        context.knowledgeSnapshots,
      );
      return combineProviderBiosOutcomes(
        cpuSupport.observations.map((observation) =>
          evaluateProviderBios(context, activeSnapshots, observation),
        ),
      );
    }
  }
}
