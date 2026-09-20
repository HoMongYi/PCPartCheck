# PCPartCheck v0.2.0 Knowledge Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add provider-neutral, replayable CPU-support, minimum-BIOS, case-to-PSU form-factor, and exact Field Evidence compatibility capabilities to PCPartCheck v0.2.0 without introducing retailer-specific behavior.

**Architecture:** Keep product catalog facts in Canonical Parts, runtime/build facts in Installation Context, and manufacturer relation data in immutable Knowledge Snapshots. Core validates and snapshots those inputs; Standard Rules interpret CPU, BIOS, and PSU semantics; Evidence contributes one deterministic rule to final aggregation while Similar Evidence remains advisory-only.

**Tech Stack:** TypeScript 6, pnpm 12, TypeBox, Vitest, Fastify shared API contracts, Changesets, GitHub Actions on Ubuntu and Windows.

**Spec:** This file is the source of truth. Sections “Gap audit” through “Version proposal” define the approved design that the task plan implements.

## Global Constraints

- Base implementation on `v0.1.0` commit `e28d542ab2db5ce5d8294fe96add8942047f4a66`.
- Keep PCPartCheck provider-neutral and public; do not add retailer product identifiers, URLs, crawling, prices, stock, quotes, orders, or admin behavior.
- Do not make live manufacturer, BuildCores, retailer, or catalog network requests. Tests and the Reference API use synthetic fixtures only.
- Preserve `PASS`, `WARNING`, `CONDITIONAL`, `UNKNOWN`, `REVIEW_REQUIRED`, `INCOMPATIBLE`, and `NOT_CHECKED`.
- Preserve `REQUIRED`, `ADVISORY`, and `DISABLED`; a disabled capability returns `NOT_CHECKED` without evaluating its rule.
- Missing required facts return `UNKNOWN`; explicit contradictions return `INCOMPATIBLE`; ambiguous or conflicting authoritative relations return `REVIEW_REQUIRED`.
- LLM output cannot create or alter Status, Decision, identities, Knowledge relations, Evidence outcomes, or version comparisons.
- Similar Evidence remains reference-only and cannot create an automatic `INCOMPATIBLE`, blocking issue, or `BLOCK` decision.
- Exact compatible Evidence cannot override any deterministic `INCOMPATIBLE` result.
- Every result remains deterministic for the same Canonical Build, Installation Context, Policy, Knowledge Snapshots, Evidence Snapshot, and version set.
- Preserve immutable v0.1.0 tags and history. Prepare v0.2.0 metadata, but do not publish npm packages, create a tag/GitHub Release, or deploy.
- Do not modify HMY-PCPartCheck during generic engine implementation. Its pin changes only after a separately approved v0.2.0 release.

## Review Focus

- Opaque BIOS strings such as `F12`, `7D75v1A`, and beta suffixes must never be compared lexically; tests require provider-issued release ordinals and return `REVIEW_REQUIRED` when the installed version cannot be resolved uniquely.
- Two active providers or two unsuperseded snapshots may disagree about CPU support; tests require `REVIEW_REQUIRED` and prove that confidence, timestamp, and provider name do not choose a winner.
- A Knowledge Snapshot may supersede an older snapshot while both remain replay input; tests require the supersession graph to select only the active leaf and reject cycles or dangling cross-provider links.
- Exact Evidence with one different component, hardware revision, BIOS version, or required context fact must not affect Status or Decision; each mismatch has a focused test in Task 8 or 9.
- A request with no Knowledge Snapshot must remain valid for existing consumers, produce `UNKNOWN` for enabled knowledge capabilities, and record an empty normalized snapshot list for replay.

---

## Repository guard and v0.1.0 baseline

- Repository root: `E:\Personal\PCPartCheck`.
- Planning branch: `docs/phase-3-pcpartcheck-v0.2-plan`, created from local `main`.
- Planning base and dereferenced annotated tag `v0.1.0`: `e28d542ab2db5ce5d8294fe96add8942047f4a66`.
- Local `main`, `origin/main`, and `feat/checkpoint-1-foundation` all point to that same commit; `v0.1.0` is its ancestor.
- The original checkout was on `design/hmy-pcpartcheck-product-20260919` at `e4f788ea30b93c7a01c6c364c0d0e2903a5b3aa9` with an untracked `AGENTS.md`; it was left untouched and work moved to an isolated worktree.
- Public packages at v0.1.0: `api-contracts`, `core`, `demo-data`, `evidence`, `http-server`, `identity`, `llm-toolkit`, `power`, `provider-buildcores`, `provider-sdk`, `rules-standard`, `similarity`, `storage-sqlite`, and `unit-normalization`.
- Local release evidence: annotated `v0.1.0` tag points to the planning base. HANDOFF's older sentence that the tag had not yet been created is stale; GitHub Release and npm publication were not re-queried in this planning session. This plan performs no release mutation.
- Existing recorded release gate: repository HANDOFF records Ubuntu, Windows, Docker, unit, integration, build, E2E, docs, version, and pack checks as passed for v0.1.0.
- Session baseline limitation: offline install could not find the cached `d3-geo@3.1.1` tarball; the installed checkout’s unit command then hit sandbox `spawn EPERM`, and the external retry was not executed because approval review returned HTTP 429. No tracked files changed. Implementation must rerun the complete baseline before Task 1.

## Gap audit

| Area | v0.1.0 evidence | Gap for v0.2.0 |
|---|---|---|
| Case ↔ PSU form factor | `PcCaseSpec.supportedPsuFormFactors` and `PsuSpec.formFactor` already exist in `packages/core/src/canonical/part-spec.ts`. | No rule evaluates them. PSU form factor is required today, so a valid canonical record cannot express an unknown value even though the required behavior is `UNKNOWN`. |
| CPU support | `CpuSupportRecordSchema` and `CpuSupportProvider` exist in `provider-sdk`. | Records are provider calls, not immutable replay inputs; the engine and RuleSet never receive them. |
| Minimum BIOS | `InstallationContext.installedBiosVersion` and `BiosReleaseRecordSchema` exist. | No provider-neutral release ordering, relation cross-reference, conflict handling, hardware-revision condition, or BIOS rule exists. |
| Knowledge | Provider versions are recorded in Result Snapshots. | There is no Knowledge Snapshot schema, immutable source provenance, supersession, relation identity, semantic validation, or engine input. |
| Exact Evidence | Field Evidence 3.0 distinguishes approved Exact and Similar records, includes BIOS in typed context matching, and prevents exact success from overriding a hard failure. | Exact application occurs only in Reference Demo post-processing. Rules cannot see `evidenceSnapshot`; hardware revisions and required context completeness are not represented; approved supersession leaves multiple approved records eligible. |
| Similar Evidence | `rankSimilarFieldEvidence` returns advisory matches and does not alter Status or Decision. | Preserve this behavior while exact Evidence enters final orchestration. |
| Engine | Core sorts rules, validates inputs, snapshots Evidence JSON, replays with exact versions, and aggregates the required decision matrix. | Rule context omits Knowledge and Evidence. Result Snapshot has no Knowledge schema or Evidence policy version. |
| Final decisions | `aggregateRuleResults` already implements required incompatible → `BLOCK`, required unknown/review → `REVIEW`, no required result → `NO_DECISION`, required conditional → `ALLOW_IF_CONDITIONS_MET`, and warnings → `ALLOW_WITH_WARNING`. | New rules must feed this matrix without a second competing decision engine. |
| Versioning | Canonical 3.0.0, Installation Context 2.0.0, Field Evidence 3.0.0, Result Snapshot 2.0.0, RuleSet 0.1.0, Engine/packages 0.1.0. | Actual contract changes require independent bumps; Identity Mapper and BuildCores adapter do not change merely because v0.2.0 exists. |

## Phase 3 scope

1. A versioned, provider-neutral Knowledge Snapshot contract for CPU support and BIOS release history.
2. Deterministic snapshot supersession, provenance validation, relation conflict detection, and replay capture.
3. Typed component hardware revisions in Installation Context.
4. Case ↔ PSU form-factor rule with explicit missing-data semantics.
5. CPU support and minimum-BIOS rules with no generic parsing of opaque BIOS strings.
6. Field Evidence 4.0 exact-applicability semantics and active-record derivation.
7. Exact Field Evidence as a normal required capability in the final rule aggregation.
8. Synthetic Reference API/demo fixtures, shared DTO/OpenAPI updates, version checks, Changesets, documentation, and Ubuntu/Windows CI.

## Out of scope

- Live manufacturer, retailer, BuildCores, QVL, BIOS, or catalog fetching.
- Scrapers, browser automation, source-specific HTML parsing, prices, inventory, quotes, customer/order data, or deployment.
- A real manufacturer provider implementation or credentials.
- RAM QVL compatibility decisions. The relation envelope must allow a future typed relation addition, but v0.2.0 implements only CPU support and BIOS release semantics.
- Performance, thermal, acoustic, or overclocking prediction.
- Admin UI, Estimate UI, production persistence, database migration, or public release publication.
- HMY-PCPartCheck code or engine-pin changes.

## Considered approaches

### A. Core-owned Knowledge contract with rule-owned semantics — recommended

`@pcpartcheck/core` owns the immutable input schema because the engine must validate, canonicalize, snapshot, and replay it without depending on another internal package. `provider-sdk` supplies snapshots, `rules-standard` interprets CPU/BIOS relations, and `evidence` contributes an EngineRule. This preserves the existing dependency direction and keeps relations out of Canonical Parts.

### B. New `@pcpartcheck/knowledge` package

A separate package makes the domain name visible, but either Core must depend on it or it must duplicate Part ID/category primitives. The first reverses the current “Core has no internal dependencies” rule; the second creates two identity contracts. Do not use this approach in v0.2.0.

### C. Store relations inside Canonical Parts or opaque Evidence JSON

Arrays on Motherboard/CPU records create large mutable catalogs and couple part revisions to provider relation history. Opaque JSON avoids a schema but gives up validation, conflict detection, provenance, and typed replay. Reject this approach.

## Architecture and package boundaries

```text
provider-sdk ──produces──> Core KnowledgeSnapshot[]
                                │
api-contracts ──validates───────┤
                                v
Core engine: Canonical Build + Installation Context + Policy
           + Knowledge Snapshots + Evidence Snapshot
                                │
              ┌─────────────────┼─────────────────┐
              v                 v                 v
       rules-standard      evidence rule       power rules
       CPU/BIOS/PSU        Exact only          unchanged
              └─────────────────┼─────────────────┘
                                v
                 existing aggregateRuleResults
                                v
                       ResultSnapshot 3.0
```

- `@pcpartcheck/core`: Knowledge schemas, semantic validation, canonical ordering, engine input/context, replay/version fields, Installation Context, and Canonical schema relaxation.
- `@pcpartcheck/provider-sdk`: a provider-neutral `KnowledgeSnapshotProvider`; existing role-specific manufacturer interfaces remain valid adapter ingress contracts.
- `@pcpartcheck/rules-standard`: Knowledge resolution plus CPU support, minimum BIOS, and PSU form-factor rules. It continues to depend only on Core.
- `@pcpartcheck/evidence`: Field Evidence 4.0 matching, active supersession, and `exact-field-evidence` EngineRule. This avoids a `rules-standard → evidence` dependency.
- `@pcpartcheck/api-contracts`: HTTP validation and DTOs only; no decision logic.
- `@pcpartcheck/demo-data` and Reference API: synthetic composition proving the contracts. They do not impersonate a live provider.
- `@pcpartcheck/similarity`: adapts to Field Evidence 4.0 types but remains output-only advisory logic.

## Public contract proposal

### Compatibility input and rule context

```ts
export interface CompatibilityCheckInput {
  readonly build: CanonicalBuild;
  readonly intent: BuildIntent;
  readonly installationContext: InstallationContext;
  readonly policyProfile: PolicyProfile;
  readonly knowledgeSnapshots?: readonly KnowledgeSnapshot[];
  readonly evidenceSnapshot: JsonValue;
}

export interface CompatibilityRuleContext {
  readonly build: CanonicalBuild;
  readonly intent: BuildIntent;
  readonly installationContext: InstallationContext;
  readonly policy: CapabilityPolicy;
  readonly knowledgeSnapshots: readonly KnowledgeSnapshot[];
  readonly evidenceSnapshot: JsonValue;
}

export interface RuleEvaluation {
  readonly status: CompatibilityStatus;
  readonly summary: string;
  readonly reasons: readonly string[];
  readonly conditions?: readonly RuleCondition[];
  readonly evidenceIds: readonly string[];
  readonly knowledgeRelationIds?: readonly string[];
}
```

Requests may omit `knowledgeSnapshots` for source compatibility. The engine normalizes omission to `[]`, and Result Snapshot input always records the normalized array. Enabled knowledge rules then return `UNKNOWN`; they never infer support.

### Compatibility and deliberate version boundaries

- Adding optional `knowledgeSnapshots` and optional `knowledgeRelationIds` is source-compatible for v0.1 callers. Existing status, decision, policy, and rule ordering contracts do not change.
- Canonical Schema 3.1 and Installation Context 2.1 change serialized version literals. The v0.2 engine accepts only its current literals after boundary normalization. Core exports `upgradeCanonicalPart3To3_1`, `upgradeCanonicalBuild3To3_1`, and `upgradeInstallationContext2To2_1`; each accepts `unknown`, requires the exact old version, changes only the version literal, validates the result, and never invents a PSU form factor or hardware revision.
- Field Evidence 3.0 records remain readable historical records. New writes use 4.0. Exact orchestration accepts only validated v4 records because v3 has no approved exact scope or hardware revision contract; there is no automatic v3 → v4 conversion.
- Result Snapshot 2.0 remains replayable by the v0.1 runtime. The v0.2 runtime rejects it explicitly because its Knowledge and Evidence policy inputs were never recorded. Silent reinterpretation would violate deterministic replay.

These are deliberate serialized-contract boundaries. The upgrade helpers cover facts that can be preserved exactly; the Evidence and Result Snapshot boundaries remain explicit because missing policy facts cannot be reconstructed safely.

### Installation Context and Canonical PSU

```ts
export interface ComponentRevision {
  readonly partId: PartId;
  readonly hardwareRevision: string;
}

export interface InstallationContext {
  readonly schemaVersion: '2.1.0';
  readonly componentRevisions?: readonly ComponentRevision[];
  readonly installedBiosVersion?: string;
  // Existing typed fields remain unchanged.
}

export interface PsuSpec {
  readonly formFactor?: PsuFormFactor;
  readonly ratedPowerW: number;
  // Existing fields remain unchanged.
}
```

`componentRevisions` rejects duplicate `partId` values at the engine boundary. Making PSU `formFactor` optional broadens valid input and allows the required missing-data `UNKNOWN` result.

## Knowledge Snapshot schema proposal

```ts
export const KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION = '1.0.0' as const;

export interface KnowledgeProviderReference {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly dataRevision?: string;
  readonly schemaFingerprint?: string;
}

export interface KnowledgeSourceReference {
  readonly sourceId: string;
  readonly sourceUri?: string;
  readonly capturedAt: string;
  readonly contentHash?: `sha256:${string}`;
  readonly evidenceIds: readonly string[];
}

export interface KnowledgePartIdentity {
  readonly partId: PartId;
  readonly category: 'CPU' | 'MOTHERBOARD';
  readonly hardwareRevision?: string;
}

export interface BiosReleaseRelation {
  readonly relationId: string;
  readonly relationType: 'BIOS_RELEASE';
  readonly subject: KnowledgePartIdentity & { readonly category: 'MOTHERBOARD' };
  readonly biosVersion: string;
  readonly releaseOrdinal: number;
  readonly releasedAt?: string;
  readonly sourceIds: readonly string[];
}

export type CpuSupportRelation =
  | {
      readonly relationId: string;
      readonly relationType: 'CPU_SUPPORT';
      readonly subject: KnowledgePartIdentity & { readonly category: 'MOTHERBOARD' };
      readonly related: KnowledgePartIdentity & { readonly category: 'CPU' };
      readonly support: 'UNSUPPORTED';
      readonly sourceIds: readonly string[];
    }
  | {
      readonly relationId: string;
      readonly relationType: 'CPU_SUPPORT';
      readonly subject: KnowledgePartIdentity & { readonly category: 'MOTHERBOARD' };
      readonly related: KnowledgePartIdentity & { readonly category: 'CPU' };
      readonly support: 'SUPPORTED';
      readonly biosRequirement:
        | { readonly kind: 'NONE' }
        | { readonly kind: 'UNKNOWN' }
        | { readonly kind: 'MINIMUM'; readonly biosReleaseId: string };
      readonly sourceIds: readonly string[];
    };

export interface KnowledgeSnapshot {
  readonly schemaVersion: '1.0.0';
  readonly snapshotId: string;
  readonly supersedesSnapshotId?: string;
  readonly provider: KnowledgeProviderReference;
  readonly collectedAt: string;
  readonly sources: readonly KnowledgeSourceReference[];
  readonly relations: readonly (CpuSupportRelation | BiosReleaseRelation)[];
}
```

Semantic validation adds constraints TypeBox alone cannot express:

- `snapshotId` and `relationId` are globally unique across one replay input; `sourceId` is unique inside its snapshot. Global relation identity makes every `RuleEvaluation.knowledgeRelationIds` entry unambiguous.
- Every relation has at least one `sourceId`, and every ID resolves inside its snapshot.
- Every source has at least one durable provenance locator: `sourceUri`, `contentHash`, or an `evidenceId`.
- Every `biosRequirement.kind = 'MINIMUM'` reference resolves inside the same snapshot to a BIOS release for the same motherboard identity and hardware-revision condition.
- BIOS `releaseOrdinal` is a non-negative provider-issued ordering value; the engine never parses or lexically compares version strings.
- A snapshot may supersede only a snapshot from the same provider ID. Duplicate IDs, dangling references, cross-provider references, self-links, and cycles are invalid input and are rejected. Multiple active leaves are structurally valid; overlapping relation keys from those leaves are retained and resolved as agreement or conflict by rules.
- Canonicalization sorts snapshots by `snapshotId`, sources by `sourceId`, and relations by `relationId` before evaluation and snapshot storage.
- Relations added later, such as `MEMORY_QVL`, `STORAGE_SUPPORT`, or `PCIE_RESOURCE`, become new discriminated union members and require a Knowledge Snapshot schema minor bump.

## CPU support and minimum-BIOS semantics

The resolver indexes only active snapshot leaves. It first evaluates each provider independently, then compares semantic observations while retaining every relation ID. CPU support agreement compares `SUPPORTED`/`UNSUPPORTED`; minimum-BIOS agreement compares the exact referenced `biosVersion`, never provider-local relation IDs or cross-provider ordinals. Each provider's installed/minimum comparison uses only that provider's release ordinals. Provider name, timestamp, alphabetic order, and numeric confidence never choose a winner.

| Situation | CPU support rule | Minimum BIOS rule | Required decision effect |
|---|---|---|---|
| Capability disabled | `NOT_CHECKED` | `NOT_CHECKED` | No decision from that capability |
| CPU or motherboard missing | `UNKNOWN` | `UNKNOWN` | `REVIEW` |
| Support relation absent | `UNKNOWN` | `UNKNOWN` | `REVIEW` |
| Explicit unsupported relation | `INCOMPATIBLE` | `NOT_CHECKED` | `BLOCK` |
| Supported, no minimum BIOS | `PASS` | `PASS` | Continue aggregation |
| Supported, BIOS requirement is unknown | `PASS` | `UNKNOWN` | `REVIEW` |
| Supported, minimum BIOS, installed version absent | `PASS` | `UNKNOWN` | `REVIEW` |
| Installed version resolves to ordinal at/above minimum | `PASS` | `PASS` | Continue aggregation |
| Installed version resolves below minimum | `PASS` | `INCOMPATIBLE` | `BLOCK` |
| Installed version string has no unique BIOS release | `PASS` | `REVIEW_REQUIRED` | `REVIEW` |
| Active support values conflict | `REVIEW_REQUIRED` | `REVIEW_REQUIRED` | `REVIEW` |
| Support agrees but active minimum-BIOS requirements conflict | `PASS` | `REVIEW_REQUIRED` | `REVIEW` |
| Relation requires a hardware revision and current revision is absent | `UNKNOWN` | `UNKNOWN` | `REVIEW` |
| Current hardware revision differs and no generic relation applies | `UNKNOWN` | `UNKNOWN` | `REVIEW` |

## Case ↔ PSU form-factor semantics

Rule ID `psu-form-factor`, capability ID `psu-form-factor`:

| Input | Status |
|---|---|
| Capability disabled | `NOT_CHECKED` from the engine without rule execution |
| Case or PSU absent | `UNKNOWN` |
| `supportedPsuFormFactors` absent | `UNKNOWN` |
| PSU `formFactor` absent | `UNKNOWN` |
| PSU form factor is listed | `PASS` |
| PSU form factor is explicitly not listed | `INCOMPATIBLE` |

The rule compares canonical enum values. It does not treat `SFX_L` as `SFX`, infer adapter brackets, or normalize arbitrary strings.

## Exact Field Evidence orchestration

Field Evidence 4.0 adds an explicit exact scope while preserving immutable records:

```ts
export const FIELD_EVIDENCE_SCHEMA_VERSION = '4.0.0' as const;
export const FIELD_EVIDENCE_POLICY_VERSION = '1.0.0' as const;

export type MaterialContextField =
  | 'radiators'
  | 'hddCages'
  | 'gpuOrientation'
  | 'occupiedPcieSlotIds'
  | 'pciePower'
  | 'installedBiosVersion'
  | 'componentRevisions';

export interface ExactEvidenceScope {
  readonly requiredPartCategories: readonly PartCategory[];
  readonly requiredContextFields: readonly MaterialContextField[];
}

export interface FieldEvidencePartReference {
  readonly category: PartCategory;
  readonly partId: PartId;
  readonly hardwareRevision?: string;
}

export interface FieldEvidenceSnapshot {
  readonly fieldEvidenceSchemaVersion: '4.0.0';
  readonly evidencePolicyVersion: '1.0.0';
  readonly records: readonly FieldEvidenceRecord[];
}
```

- Core continues to store `evidenceSnapshot` as provider-neutral `JsonValue`; the Evidence package owns `FieldEvidenceSnapshotSchema` and its semantic validator. The exact rule returns `NOT_CHECKED` for an absent/empty v4 envelope and rejects a malformed envelope at the composition boundary.
- An approved record is active when no other approved record in the snapshot supersedes it. Records remain immutable; activity is derived without changing the older row.
- Duplicate evidence IDs, dangling supersession references, self-links, and cycles are invalid. Branching approved supersession chains are retained as conflicts and produce `REVIEW_REQUIRED` rather than choosing by timestamp.
- Evidence Policy 1.0 prevents a record from making itself exact with an under-scoped declaration. Automatic exact matching requires the record's part references to equal the complete selected build part set, requires present/equal hardware revisions for every selected part, and always requires present/equal `installedBiosVersion`. `requiredPartCategories` must equal the distinct categories in the complete record part set; it cannot omit a selected category.
- The policy also requires present/equal issue-specific context: `PHYSICAL_CLEARANCE` → `radiators`, `hddCages`, `gpuOrientation`; `RADIATOR_CLEARANCE` → `radiators`, `hddCages`; `POWER_CONNECTOR` → `pciePower`; `STORAGE_RESOURCE` → `occupiedPcieSlotIds`. `MEMORY_CLEARANCE` and `BIOS_POST` use the global full-part/revision/BIOS requirements. `THERMAL` is not eligible for automatic exact decisions in v0.2 because the current context lacks ambient/load/cooling-state facts.
- A record's `requiredContextFields` may add stricter fields but cannot remove policy minima. Approval validates the scope against the versioned policy; evaluation validates it again before use.
- `customFacts` never become automatic compatibility input.
- Missing any globally or issue-required fact prevents Exact classification; it remains Similar/advisory.
- Similar or incomplete matches remain available to `@pcpartcheck/similarity` but are excluded from the exact rule.

The new `exact-field-evidence` EngineRule reads the validated Evidence Snapshot and returns one normal RuleEvaluation:

| Active exact evidence | Rule status |
|---|---|
| None | `NOT_CHECKED` |
| Unconditional assembly failure | `INCOMPATIBLE` |
| Conditional success | `CONDITIONAL` with conditions |
| Assembly success | `PASS` |
| Conflicting active exact outcomes for the same issue/scope, or supersession branches | `REVIEW_REQUIRED` |

Independent issue/scope groups do not conflict merely because their outcomes differ. Within the single rule evaluation, precedence is: unambiguous failure → `INCOMPATIBLE`; otherwise any group conflict → `REVIEW_REQUIRED`; otherwise any conditional result → `CONDITIONAL`; otherwise any success → `PASS`; otherwise `NOT_CHECKED`. A failure and success inside the same group is a conflict, not an unambiguous failure.

This rule uses capability ID `exact-field-evidence`. In the Reference Policy it is `REQUIRED`. Existing aggregation therefore enforces failure → `BLOCK`, conditional → `ALLOW_IF_CONDITIONS_MET`, ambiguity → `REVIEW`, and success cannot override a separate deterministic failure.

## Final compatibility orchestration

No second decision matrix is introduced. The v0.1.0 `aggregateRuleResults` order remains:

1. Any REQUIRED `INCOMPATIBLE` → `BLOCK`.
2. Else any REQUIRED `UNKNOWN` or `REVIEW_REQUIRED` → `REVIEW`.
3. Else no evaluated REQUIRED result → `NO_DECISION`.
4. Else any REQUIRED `CONDITIONAL` → `ALLOW_IF_CONDITIONS_MET`.
5. Else warnings or non-pass ADVISORY results → `ALLOW_WITH_WARNING`.
6. Else → `ALLOW`.

New default capability modes:

| Capability | Default mode | Rule IDs |
|---|---|---|
| `cpu-support` | `REQUIRED` when Knowledge input is supported by the composition | `cpu-support` |
| `bios` | `REQUIRED` when Knowledge input is supported by the composition | `minimum-bios` |
| `psu-form-factor` | `REQUIRED` | `psu-form-factor` |
| `exact-field-evidence` | `REQUIRED` | `exact-field-evidence` |
| Future `qvl` | `DISABLED` | none in v0.2.0 |

For the generic Reference API, provider availability means the capability contract and synthetic fixture composition exist. It does not claim a live manufacturer provider.

## Version proposal

| Domain | v0.1.0 | v0.2.0 proposal | Reason |
|---|---:|---:|---|
| Engine | `0.1.0` | `0.2.0` | New deterministic inputs, context, rules, and replay metadata. |
| Canonical Schema | `3.0.0` | `3.1.0` | PSU `formFactor` becomes optional so missing facts are representable. Existing facts upgrade losslessly through the explicit 3.0 → 3.1 helper; the old version literal is not silently accepted. |
| Installation Context | `2.0.0` | `2.1.0` | Adds optional typed component hardware revisions. |
| Knowledge Snapshot | absent | `1.0.0` | New independent provider-neutral relation contract. |
| Field Evidence | `3.0.0` | `4.0.0` | Exact applicability, hardware revision, and active supersession semantics change matching behavior. |
| Evidence Policy | absent | `1.0.0` | New deterministic active/exact/conflict policy. |
| Result Snapshot | `2.0.0` | `3.0.0` | Captures Knowledge inputs plus Knowledge/Evidence policy versions and optional relation references. |
| Standard RuleSet | `0.1.0` | `0.2.0` | Adds CPU support, BIOS, and PSU form-factor behavior. |
| Reference Policy | `1.0.0` | `2.0.0` | Enables new required capabilities and therefore changes decisions. |
| Identity Mapper | `1.1.0` | unchanged | No identity mapping algorithm changes. |
| BuildCores Adapter | `3.0.0` | unchanged | No provider mapping or alias changes. Compatibility tests update only. |
| Build Intent | `1.0.0` | unchanged | No intent contract change. |

Package Changesets must bump only packages whose public contract or dependency range changes. Planned direct-contract bumps are `core`, `evidence`, `provider-sdk`, `rules-standard`, `api-contracts`, `demo-data`, and `similarity` from `0.1.0` to `0.2.0`. With the current `updateInternalDependencies: patch` policy, the expected dependency-only versions are `http-server`, `identity`, `llm-toolkit`, `power`, `provider-buildcores`, `storage-sqlite`, and `unit-normalization` at `0.1.1`; confirm the exact graph with Changesets rather than hand-editing transitive versions. Private apps remain unpublished. Update `check-versions.mjs` to validate an explicit package-version map instead of forcing every public package to one number.

v0.1.0 Result Snapshots remain valid artifacts but are replayed by the v0.1.0 runtime. The v0.2.0 runtime rejects Snapshot Format 2.0 rather than silently reinterpreting it.

## Planned file map

| Responsibility | Files |
|---|---|
| Core schema prerequisites | `packages/core/src/canonical/part-spec.ts`, `packages/core/src/installation-context.ts`, `packages/core/src/contract-upgrades.ts`, Core schema/upgrade tests |
| Knowledge contract | `packages/core/src/knowledge.ts`, `packages/core/test/knowledge-snapshot.test.ts`, `packages/core/src/index.ts` |
| Engine/replay | `packages/core/src/engine.ts`, `packages/core/src/snapshot.ts`, Core engine/result tests |
| Provider boundary | `packages/provider-sdk/src/knowledge-provider.ts`, provider SDK exports/tests |
| CPU/BIOS rules | `packages/rules-standard/src/knowledge-resolution.ts`, `cpu-support-rule.ts`, `minimum-bios-rule.ts`, focused tests |
| PSU rule | `packages/rules-standard/src/psu-form-factor-rule.ts`, focused tests |
| Exact Evidence | `packages/evidence/src/field-evidence.ts`, `evidence-policy.ts`, `exact-field-evidence-rule.ts`, Evidence tests |
| Similar Evidence regression | `packages/similarity/src/similarity.ts`, `packages/similarity/test/similarity.test.ts` |
| Public integration | `packages/api-contracts/src/contracts.ts`, `apps/reference-api/src/services.ts`, `packages/demo-data/src/*`, integration tests, generated OpenAPI |
| Version/release/docs | `scripts/check-versions.mjs`, package manifests, Changesets, README and contract docs |

---

### Task 1: Represent unknown PSU form factor and component hardware revisions

**Purpose:** Add only the canonical/runtime facts required by the new rules while preserving every existing v0.1.0 field.

**Files:**
- Modify: `packages/core/src/canonical/part-spec.ts`
- Modify: `packages/core/src/canonical/primitives.ts`
- Modify: `packages/core/src/installation-context.ts`
- Modify: `packages/core/src/engine.ts`
- Create: `packages/core/src/contract-upgrades.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/canonical-schema.test.ts`
- Test: `packages/core/test/build-context.test.ts`
- Test: `packages/core/test/engine-snapshot.test.ts`
- Create: `packages/core/test/contract-upgrades.test.ts`

**Interfaces:**
- Produces: `CANONICAL_SCHEMA_VERSION = '3.1.0'`, `INSTALLATION_CONTEXT_SCHEMA_VERSION = '2.1.0'`, `ComponentRevisionSchema`, optional `PsuSpec.formFactor`, optional `InstallationContext.componentRevisions`, and explicit v0.1 contract upgrade helpers.
- Consumes: existing `PartIdSchema`, `PsuFormFactorSchema`, and engine input validation.

- [ ] **Step 1: Write failing schema and semantic tests**

```ts
test('canonical PSU may preserve an unknown form factor', () => {
  expect(Value.Check(CanonicalPartSchema, {
    schemaVersion: '3.1.0',
    partId: '55555555-5555-4555-8555-555555555555',
    category: 'PSU', manufacturer: 'Example', model: 'Unknown PSU', status: 'ACTIVE',
    spec: { ratedPowerW: 850 },
  })).toBe(true);
});

test('installation context rejects duplicate component revision identities', async () => {
  await expect(engine.check(inputWith({
    componentRevisions: [
      { partId: BOARD_ID, hardwareRevision: '1.0' },
      { partId: BOARD_ID, hardwareRevision: '1.1' },
    ],
  }))).rejects.toThrow('Duplicate component revision partId');
});

test('v3 PSU and v2 context upgrade only their version literals', () => {
  const upgraded = upgradeCanonicalPart3To3_1(legacyPsu({ formFactor: 'ATX' }));
  expect(upgraded).toMatchObject({ schemaVersion: '3.1.0', spec: { formFactor: 'ATX' } });
  expect(upgradeInstallationContext2To2_1(legacyContext()))
    .toEqual({ ...legacyContext(), schemaVersion: '2.1.0' });
});
```

- [ ] **Step 2: Run RED tests**

Run: `corepack pnpm exec vitest run packages/core/test/canonical-schema.test.ts packages/core/test/build-context.test.ts packages/core/test/engine-snapshot.test.ts packages/core/test/contract-upgrades.test.ts`

Expected: FAIL because schema versions remain 3.0/2.0, PSU form factor is required, and component revisions do not exist.

- [ ] **Step 3: Implement the minimal schema changes**

```ts
export const ComponentRevisionSchema = Type.Object({
  partId: PartIdSchema,
  hardwareRevision: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

// InstallationContextSchema
componentRevisions: Type.Optional(Type.Array(ComponentRevisionSchema)),

// PsuSpecSchema
formFactor: Type.Optional(PsuFormFactorSchema),
```

Add an engine-boundary uniqueness check for `componentRevisions[].partId`; do not choose one duplicate by array order. Upgrade helpers accept `unknown`, require the exact v0.1 version literal, clone, replace only that literal, validate the current schema, and reject anything that cannot be preserved exactly.

- [ ] **Step 4: Run GREEN and affected regression**

Run: `corepack pnpm exec vitest run packages/core/test/canonical-schema.test.ts packages/core/test/build-context.test.ts packages/core/test/engine-snapshot.test.ts packages/core/test/contract-upgrades.test.ts packages/provider-buildcores/test/provider-buildcores.test.ts`

Expected: PASS; existing explicit PSU form factors and BuildCores mappings remain valid.

- [ ] **Step 5: Self-review and commit**

Confirm no Canonical field unrelated to PSU or component revisions changed and no upgrade helper synthesizes a missing fact.

```bash
git add packages/core/src packages/core/test packages/provider-buildcores/test
git commit -m "feat(core): represent PSU and component revision unknowns"
```

### Task 2: Define and validate Knowledge Snapshot 1.0

**Purpose:** Create a closed, provider-neutral CPU support and BIOS relation contract outside Canonical Parts.

**Files:**
- Create: `packages/core/src/knowledge.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/knowledge-snapshot.test.ts`

**Interfaces:**
- Produces: `KnowledgeSnapshotSchema`, relation schemas/types, `KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION`, `validateAndCanonicalizeKnowledgeSnapshots(snapshots): readonly KnowledgeSnapshot[]`, and `InvalidKnowledgeSnapshotError`.
- Consumes: Part IDs and JSON-safe public primitives from Core.

- [ ] **Step 1: Write failing contract tests**

```ts
test('rejects a relation whose provenance source is missing', () => {
  expect(() => validateAndCanonicalizeKnowledgeSnapshots([
    snapshot({ sources: [], relations: [supportedCpu({ sourceIds: ['missing'] })] }),
  ])).toThrow('Unknown knowledge sourceId: missing');
});

test('keeps stale snapshots but activates only an explicit superseding leaf', () => {
  const oldSnapshot = snapshot({ snapshotId: 'old', providerVersion: '1' });
  const newSnapshot = snapshot({ snapshotId: 'new', providerVersion: '2', supersedesSnapshotId: 'old' });
  expect(activeKnowledgeSnapshots([newSnapshot, oldSnapshot]).map(x => x.snapshotId)).toEqual(['new']);
});

test('rejects relation identity ambiguity', () => {
  expect(() => validateAndCanonicalizeKnowledgeSnapshots([
    snapshot({ relations: [supportedCpu({ relationId: 'same' }), unsupportedCpu({ relationId: 'same' })] }),
  ])).toThrow('Duplicate knowledge relationId: same');
});

test('distinguishes no BIOS requirement from an unknown requirement', () => {
  expect(supportedCpu({ biosRequirement: { kind: 'NONE' } }))
    .not.toEqual(supportedCpu({ biosRequirement: { kind: 'UNKNOWN' } }));
});
```

- [ ] **Step 2: Run RED tests**

Run: `corepack pnpm exec vitest run packages/core/test/knowledge-snapshot.test.ts`

Expected: FAIL because no Knowledge Snapshot exports exist.

- [ ] **Step 3: Implement schemas, semantic validation, and ordering**

```ts
export const KnowledgeRelationSchema = Type.Union([
  CpuSupportRelationSchema,
  BiosReleaseRelationSchema,
]);

export function validateAndCanonicalizeKnowledgeSnapshots(
  snapshots: readonly KnowledgeSnapshot[],
): readonly KnowledgeSnapshot[] {
  // TypeBox validation, global snapshot/relation IDs, provenance locators,
  // source/minimum BIOS references,
  // same-provider acyclic supersession, then stable ID sorting.
}
```

Do not parse BIOS version strings, select a provider, or discard superseded input from the returned replay array. Export a separate active-leaf helper for rule resolution.

- [ ] **Step 4: Run GREEN and Core regression**

Run: `corepack pnpm exec vitest run packages/core/test/knowledge-snapshot.test.ts packages/core/test/canonical-schema.test.ts`

Expected: PASS, including deterministic output for reversed input order; a provider-version change remains visible in the normalized replay input rather than being merged away.

- [ ] **Step 5: Self-review and commit**

Verify every relation can trace `relationId → snapshotId → sourceIds → source URI/hash/evidence IDs` and overlapping unsuperseded leaves remain available for conflict resolution.

```bash
git add packages/core/src/knowledge.ts packages/core/src/index.ts packages/core/test/knowledge-snapshot.test.ts
git commit -m "feat(core): add provider-neutral knowledge snapshots"
```

### Task 3: Carry Knowledge and Evidence through engine context and replay

**Purpose:** Make the new deterministic inputs available to rules and preserve them in Result Snapshot 3.0.

**Files:**
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/snapshot.ts`
- Modify: `packages/core/src/rule.ts`
- Modify: `packages/core/test/engine-snapshot.test.ts`
- Modify: `packages/core/test/result-aggregation.test.ts`

**Interfaces:**
- Consumes: Task 2 `KnowledgeSnapshot` and canonicalizer.
- Produces: rule-context `knowledgeSnapshots` and `evidenceSnapshot`, optional input `knowledgeSnapshots`, required normalized `inputSnapshot.knowledgeSnapshots`, Result Snapshot/`EngineVersions` fields `knowledgeSnapshotSchemaVersion` and `evidencePolicyVersion`, optional `knowledgeRelationIds`, and Snapshot Format 3.0.

- [ ] **Step 1: Write failing engine/replay tests**

```ts
test('normalizes omitted knowledge to an immutable empty replay input', async () => {
  const snapshot = await engine.check(inputWithoutKnowledge);
  expect(snapshot.inputSnapshot.knowledgeSnapshots).toEqual([]);
  expect(receivedRuleContext.knowledgeSnapshots).toEqual([]);
  expect(receivedRuleContext.evidenceSnapshot).toEqual(inputWithoutKnowledge.evidenceSnapshot);
});

test('rejects replay when knowledge or evidence policy versions drift', async () => {
  await expect(engine.replay({ ...snapshot, knowledgeSnapshotSchemaVersion: '0.9.0' }))
    .rejects.toMatchObject({ field: 'knowledgeSnapshotSchemaVersion' });
});
```

- [ ] **Step 2: Run RED tests**

Run: `corepack pnpm exec vitest run packages/core/test/engine-snapshot.test.ts packages/core/test/result-aggregation.test.ts`

Expected: FAIL because rules do not receive these inputs and snapshot version fields are absent.

- [ ] **Step 3: Implement minimal engine plumbing**

```ts
export interface CompatibilityRuleContext {
  readonly build: CanonicalBuild;
  readonly intent: BuildIntent;
  readonly installationContext: InstallationContext;
  readonly policy: CapabilityPolicy;
  readonly knowledgeSnapshots: readonly KnowledgeSnapshot[];
  readonly evidenceSnapshot: JsonValue;
}
```

Canonicalize once before evaluating rules, clone once into `inputSnapshot`, and pass the same immutable values to every rule. Core validates Knowledge because it owns that schema; it preserves Evidence as cloned JSON while the Evidence rule validates its own envelope. Extend replay version checks and API-facing result types; keep rule order and decision aggregation unchanged.

- [ ] **Step 4: Run GREEN and deterministic regression**

Run: `corepack pnpm exec vitest run packages/core/test`

Expected: PASS; reversed Knowledge input order produces identical normalized snapshots and rule results with a fixed clock.

- [ ] **Step 5: Self-review and commit**

Confirm `evidenceSnapshot` remains cloned, Similar Evidence has no Core special case, and v0.1 Snapshot Format is rejected explicitly.

```bash
git add packages/core/src packages/core/test
git commit -m "feat(core): snapshot knowledge and evidence rule inputs"
```

### Task 4: Add the provider-neutral Knowledge provider boundary

**Purpose:** Let future adapters supply immutable snapshots without exposing source-specific records to rules.

**Files:**
- Create: `packages/provider-sdk/src/knowledge-provider.ts`
- Modify: `packages/provider-sdk/src/index.ts`
- Modify: `packages/provider-sdk/src/manufacturer-providers.ts`
- Create: `packages/provider-sdk/test/knowledge-provider.test.ts`
- Modify: `packages/provider-sdk/test/future-provider-contracts.test.ts`

**Interfaces:**
- Consumes: Core `KnowledgeSnapshot` and `PartId`.
- Produces: `KnowledgeSnapshotQuery` and `KnowledgeSnapshotProvider.loadKnowledgeSnapshots(query)`.
- Preserves: existing `CpuSupportProvider`, `BiosReleaseProvider`, and `MemoryQvlProvider` as adapter ingress interfaces.

- [ ] **Step 1: Write failing public-type and fixture tests**

```ts
expectTypeOf<KnowledgeSnapshotProvider>().toMatchTypeOf<{
  providerId: string;
  loadKnowledgeSnapshots(query: {
    subjectPartIds: readonly string[];
  }): Promise<readonly KnowledgeSnapshot[]>;
}>();
```

Add a synthetic provider that returns cloned snapshots and proves caller mutation cannot alter its stored fixture.

- [ ] **Step 2: Run RED tests**

Run: `corepack pnpm exec vitest run packages/provider-sdk/test`

Expected: FAIL because the provider interface is not exported.

- [ ] **Step 3: Implement the interface and compatibility documentation comments**

```ts
export interface KnowledgeSnapshotProvider {
  readonly providerId: string;
  readonly attribution: ProviderAttribution;
  loadKnowledgeSnapshots(
    query: KnowledgeSnapshotQuery,
  ): Promise<readonly KnowledgeSnapshot[]>;
}
```

Do not add network clients, URLs beyond generic attribution/source references, or a manufacturer implementation.

- [ ] **Step 4: Run GREEN, affected regression, and dependency checks**

Run: `corepack pnpm exec vitest run packages/provider-sdk/test`

Run: `corepack pnpm check:deps`

Expected: PASS; existing role-specific provider contract regression stays green and Provider SDK depends on Core in the existing allowed direction.

- [ ] **Step 5: Self-review and commit**

```bash
git add packages/provider-sdk
git commit -m "feat(provider-sdk): define knowledge snapshot provider"
```

### Task 5: Resolve CPU support without guessing conflicts

**Purpose:** Implement official support, absence, revision, and conflict semantics as a REQUIRED-capable rule.

**Files:**
- Create: `packages/rules-standard/src/knowledge-resolution.ts`
- Create: `packages/rules-standard/src/cpu-support-rule.ts`
- Modify: `packages/rules-standard/src/index.ts`
- Create: `packages/rules-standard/test/cpu-support-rule.test.ts`

**Interfaces:**
- Consumes: active Core Knowledge Snapshots and component revisions.
- Produces: `resolveCpuSupport(context): CpuSupportResolution` and `cpuSupportRule` (`ruleId`/`capabilityId`: `cpu-support`).

- [ ] **Step 1: Write the required RED matrix**

```ts
test.each([
  ['exact supported CPU', supportedKnowledge(), 'PASS'],
  ['unsupported CPU', unsupportedKnowledge(), 'INCOMPATIBLE'],
  ['support list unavailable', [], 'UNKNOWN'],
  ['conflicting active providers', conflictingKnowledge(), 'REVIEW_REQUIRED'],
] as const)('%s', async (_name, knowledgeSnapshots, status) => {
  expect(await cpuSupportRule.evaluate(context({ knowledgeSnapshots })))
    .toMatchObject({ status });
});
```

Add revision tests: exact revision applies; required revision absent is `UNKNOWN`; different revision without a generic relation is `UNKNOWN`.

- [ ] **Step 2: Run RED tests**

Run: `corepack pnpm exec vitest run packages/rules-standard/test/cpu-support-rule.test.ts`

Expected: FAIL because resolver and rule do not exist.

- [ ] **Step 3: Implement deterministic resolution**

```ts
export type CpuSupportResolution =
  | {
      readonly kind: 'SUPPORTED';
      readonly relationIds: readonly string[];
      readonly observations: readonly {
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
      }[];
    }
  | { readonly kind: 'UNSUPPORTED'; readonly relationIds: readonly string[] }
  | { readonly kind: 'MISSING' }
  | { readonly kind: 'CONFLICT'; readonly relationIds: readonly string[] };
```

Resolve support observations per active provider. Explicit `SUPPORTED` and `UNSUPPORTED` values conflict; absence from one provider is not negative evidence. If all explicit observations agree on support, merge their sorted relation IDs. Preserve each provider's BIOS requirement for Task 6; different provider-local relation IDs do not themselves conflict.

- [ ] **Step 4: Run GREEN and platform regression**

Run: `corepack pnpm exec vitest run packages/rules-standard/test/cpu-support-rule.test.ts packages/rules-standard/test/platform-rules.test.ts`

Expected: PASS with relation IDs present for every Knowledge-backed result.

- [ ] **Step 5: Self-review and commit**

```bash
git add packages/rules-standard/src packages/rules-standard/test/cpu-support-rule.test.ts
git commit -m "feat(rules): evaluate CPU support knowledge"
```

### Task 6: Evaluate minimum BIOS by provider release order

**Purpose:** Distinguish supported CPU, no/unknown/required minimum BIOS, current version state, insufficiency, and comparison ambiguity.

**Files:**
- Create: `packages/rules-standard/src/minimum-bios-rule.ts`
- Modify: `packages/rules-standard/src/knowledge-resolution.ts`
- Modify: `packages/rules-standard/src/index.ts`
- Create: `packages/rules-standard/test/minimum-bios-rule.test.ts`

**Interfaces:**
- Consumes: Task 5 `CpuSupportResolution`, BIOS release relations, and `installationContext.installedBiosVersion`.
- Produces: `resolveBiosRequirement(context): BiosRequirementResolution` and `minimumBiosRule` (`ruleId: minimum-bios`, `capabilityId: bios`).

- [ ] **Step 1: Write the complete RED edge matrix**

```ts
test.each([
  ['minimum BIOS satisfied', 'F12', releases({ F10: 10, F12: 12 }), 'PASS'],
  ['minimum BIOS insufficient', 'F10', releases({ F10: 10, F12: 12 }), 'INCOMPATIBLE'],
  ['current BIOS unknown', undefined, releases({ F12: 12 }), 'UNKNOWN'],
  ['installed string not in release history', 'F11-beta', releases({ F12: 12 }), 'REVIEW_REQUIRED'],
] as const)('%s', async (_name, installedBiosVersion, knowledgeSnapshots, status) => {
  expect(await minimumBiosRule.evaluate(context({ installedBiosVersion, knowledgeSnapshots })))
    .toMatchObject({ status });
});
```

Add support-list unavailable → `UNKNOWN`, unsupported CPU → `NOT_CHECKED`, explicit no-minimum → `PASS`, unknown requirement → `UNKNOWN`, duplicate BIOS strings with different ordinals → `REVIEW_REQUIRED`, two providers that use different relation IDs for the same minimum version → agreement, providers that require different minimum versions → `REVIEW_REQUIRED`, and `F9`/`F10` proving no lexical comparison.

- [ ] **Step 2: Run RED tests**

Run: `corepack pnpm exec vitest run packages/rules-standard/test/minimum-bios-rule.test.ts`

Expected: FAIL because the BIOS rule is absent.

- [ ] **Step 3: Implement ordinal-only comparison**

For each provider observation, resolve its minimum reference and the installed string to exactly one active BIOS release under the same motherboard/revision, then compare only that provider's `releaseOrdinal`. Combine provider outcomes only after each independent comparison: identical semantic outcomes agree; different required `biosVersion` values, ambiguous mappings, or disagreeing sufficient/insufficient outcomes return `REVIEW_REQUIRED`. Return sorted relation IDs for every support, minimum, and installed release used.

- [ ] **Step 4: Run GREEN and combined Knowledge regression**

Run: `corepack pnpm exec vitest run packages/rules-standard/test/cpu-support-rule.test.ts packages/rules-standard/test/minimum-bios-rule.test.ts`

Expected: PASS; unknown never becomes incompatible and ambiguous versions never become pass.

- [ ] **Step 5: Self-review and commit**

```bash
git add packages/rules-standard/src packages/rules-standard/test/minimum-bios-rule.test.ts
git commit -m "feat(rules): enforce minimum BIOS knowledge"
```

### Task 7: Add case-to-PSU form-factor compatibility

**Purpose:** Use existing canonical fields and the Task 1 unknown representation.

**Files:**
- Create: `packages/rules-standard/src/psu-form-factor-rule.ts`
- Modify: `packages/rules-standard/src/index.ts`
- Create: `packages/rules-standard/test/psu-form-factor-rule.test.ts`

**Interfaces:**
- Produces: `psuFormFactorRule` with `ruleId` and `capabilityId` equal to `psu-form-factor`.
- Consumes: `PcCaseSpec.supportedPsuFormFactors` and optional `PsuSpec.formFactor`.

- [ ] **Step 1: Write four focused RED tests**

```ts
test.each([
  ['explicit supported form factor', ['ATX'], 'ATX', 'PASS'],
  ['explicit unsupported form factor', ['SFX'], 'ATX', 'INCOMPATIBLE'],
  ['missing case spec', undefined, 'ATX', 'UNKNOWN'],
  ['missing PSU form factor', ['ATX'], undefined, 'UNKNOWN'],
] as const)('%s', async (_name, supported, formFactor, status) => {
  expect(await psuFormFactorRule.evaluate(contextWithPsu(supported, formFactor)))
    .toMatchObject({ status });
});
```

- [ ] **Step 2: Run RED tests**

Run: `corepack pnpm exec vitest run packages/rules-standard/test/psu-form-factor-rule.test.ts`

Expected: FAIL because the rule is not exported.

- [ ] **Step 3: Implement the literal membership rule**

```ts
if (!pcCase || !psu || !pcCase.spec.supportedPsuFormFactors || !psu.spec.formFactor) {
  return unknown('PSU form factor could not be evaluated');
}
return pcCase.spec.supportedPsuFormFactors.includes(psu.spec.formFactor)
  ? pass('Case supports the PSU form factor')
  : incompatible('Case does not support the PSU form factor');
```

- [ ] **Step 4: Run GREEN and existing clearance regression**

Run: `corepack pnpm exec vitest run packages/rules-standard/test/psu-form-factor-rule.test.ts packages/rules-standard/test/clearance-rules.test.ts`

Expected: PASS; PSU length and form-factor rules remain independent.

- [ ] **Step 5: Self-review and commit**

```bash
git add packages/rules-standard/src packages/rules-standard/test/psu-form-factor-rule.test.ts
git commit -m "feat(rules): check case PSU form factors"
```

### Task 8: Define Field Evidence 4.0 exact applicability

**Purpose:** Make exactness explicit, revision-aware, context-complete, and stable under immutable supersession.

**Files:**
- Modify: `packages/evidence/src/field-evidence.ts`
- Create: `packages/evidence/src/evidence-policy.ts`
- Modify: `packages/evidence/src/index.ts`
- Modify: `packages/evidence/test/field-evidence.test.ts`
- Modify: `packages/evidence/test/moderation.test.ts`
- Modify: `packages/similarity/src/similarity.ts`
- Modify: `packages/similarity/test/similarity.test.ts`

**Interfaces:**
- Produces: Field Evidence 4.0 schemas, `FieldEvidenceSnapshotSchema`, `FIELD_EVIDENCE_POLICY_VERSION`, `ExactEvidenceScope`, `validateAndCanonicalizeFieldEvidenceSnapshot`, `selectActiveFieldEvidence`, and revision/context-aware `classifyFieldEvidenceMatch`.
- Consumes: Installation Context 2.1 and component revisions from Task 1.

- [ ] **Step 1: Write RED tests for every exactness boundary**

```ts
test.each([
  ['one component mismatch', query({ gpuId: OTHER_GPU }), 'SIMILAR'],
  ['BIOS mismatch', query({ installedBiosVersion: 'F11' }), 'SIMILAR'],
  ['hardware revision mismatch', query({ motherboardRevision: '1.1' }), 'SIMILAR'],
  ['missing required context', query({ installedBiosVersion: undefined }), 'SIMILAR'],
] as const)('%s', (_name, queryValue, match) => {
  expect(classifyFieldEvidenceMatch(record(), queryValue)).toBe(match);
});

test('derives only the approved superseding leaf as active', () => {
  expect(selectActiveFieldEvidence([approved('old'), approved('new', 'old')]))
    .toMatchObject({ active: [{ evidenceId: 'new' }], conflicts: [] });
});
```

Add rejection for an exact scope whose required category has no part reference or omits a category in the complete record part set; reject duplicate IDs, dangling references, self-links, and cycles; retain a conflict for two approved records superseding the same active parent. Add non-exact cases for an extra/missing build part, a hardware revision missing on both sides, absent BIOS, every issue-specific policy field, and `THERMAL`. Prove that a DRAFT/REJECTED successor does not deactivate an approved record and that reversed record order canonicalizes identically.

- [ ] **Step 2: Run RED tests**

Run: `corepack pnpm exec vitest run packages/evidence/test packages/similarity/test`

Expected: FAIL because schema 3.0 has no exact scope/hardware revision policy and superseded approved records remain eligible.

- [ ] **Step 3: Implement Field Evidence 4.0 and policy helpers**

Keep DRAFT/APPROVED/REJECTED transitions and immutable moderation unchanged. Approval and evaluation both enforce Evidence Policy 1.0 minima. Validate the v4 snapshot envelope before selection. Canonically order records, part references, context arrays, and active record IDs. Similar ranking may consume the new fields for explanations but must still emit no Status or Decision. Read paths retain a discriminated v3/v4 historical union; write paths create v4 only.

- [ ] **Step 4: Run GREEN and storage regression**

Run: `corepack pnpm exec vitest run packages/evidence/test packages/similarity/test tests/integration/storage-sqlite.test.ts`

Expected: PASS; JSON persistence round-trips v4 records and Similar Evidence cannot block.

- [ ] **Step 5: Self-review and commit**

```bash
git add packages/evidence packages/similarity tests/integration/storage-sqlite.test.ts
git commit -m "feat(evidence): require revision-aware exact scope"
```

### Task 9: Feed active Exact Evidence into final aggregation

**Purpose:** Replace demo-only post-processing with one deterministic EngineRule while preserving Similar Evidence isolation.

**Files:**
- Create: `packages/evidence/src/exact-field-evidence-rule.ts`
- Modify: `packages/evidence/src/index.ts`
- Create: `packages/evidence/test/exact-field-evidence-rule.test.ts`
- Modify: `packages/core/test/result-aggregation.test.ts`

**Interfaces:**
- Consumes: Task 3 rule context and Task 8 Field Evidence Snapshot/policy.
- Produces: `exactFieldEvidenceRule` (`ruleId`/`capabilityId`: `exact-field-evidence`).

- [ ] **Step 1: Write RED orchestration tests**

```ts
test.each([
  ['exact incompatible', failureEvidence(), 'INCOMPATIBLE', 'BLOCK'],
  ['exact conditional', conditionalEvidence(), 'CONDITIONAL', 'ALLOW_IF_CONDITIONS_MET'],
  ['exact compatible', successEvidence(), 'PASS', 'ALLOW'],
] as const)('%s', async (_name, evidenceSnapshot, status, decision) => {
  const snapshot = await engineWithExactRule().check(input({ evidenceSnapshot }));
  expect(snapshot.resultSnapshot).toMatchObject({ status, decision });
});
```

Also test: one component mismatch, BIOS mismatch, revision mismatch, and missing required context produce no automatic result; Similar failure cannot block; exact success plus deterministic PSU failure remains `BLOCK`; conflicting outcomes within the same issue/scope produce `REVIEW`; different outcomes in independent issue/scope groups do not conflict; an unambiguous failure in one group plus a success in another remains `BLOCK`.

- [ ] **Step 2: Run RED tests**

Run: `corepack pnpm exec vitest run packages/evidence/test/exact-field-evidence-rule.test.ts packages/core/test/result-aggregation.test.ts`

Expected: FAIL because Exact Evidence is not an EngineRule.

- [ ] **Step 3: Implement the rule using existing aggregation**

```ts
export const exactFieldEvidenceRule: EngineRule = {
  ruleId: 'exact-field-evidence',
  capabilityId: 'exact-field-evidence',
  evaluate: ({ build, installationContext, evidenceSnapshot }) =>
    evaluateActiveExactEvidence({ build, installationContext, evidenceSnapshot }),
};
```

Return `NOT_CHECKED` for an absent/empty valid envelope or no applicable active exact record. Apply the documented within-rule precedence after grouping by issue type and exact scope. Do not mutate other RuleResults or call `aggregateRuleResults` inside the Evidence package.

- [ ] **Step 4: Run GREEN and decision regression**

Run: `corepack pnpm exec vitest run packages/evidence/test packages/core/test/result-aggregation.test.ts packages/core/test/engine-snapshot.test.ts`

Expected: PASS; the v0.1 decision matrix remains byte-for-byte unchanged.

- [ ] **Step 5: Self-review and commit**

```bash
git add packages/evidence packages/core/test
git commit -m "feat(evidence): orchestrate active exact evidence"
```

### Task 10: Integrate public DTOs, synthetic composition, and policy

**Purpose:** Prove the complete v0.2.0 flow through SDK, HTTP validation, Reference composition, and generated contracts without live data.

**Files:**
- Modify: `packages/api-contracts/src/contracts.ts`
- Modify: `packages/api-contracts/src/index.ts`
- Create: `packages/api-contracts/test/compatibility-contracts.test.ts`
- Create: `packages/demo-data/src/knowledge.ts`
- Create: `packages/demo-data/src/field-evidence-v4.ts`
- Modify: `packages/demo-data/src/scenarios.ts`
- Modify: `packages/demo-data/src/index.ts`
- Modify: `apps/reference-api/src/services.ts`
- Modify: `tests/integration/reference-api.test.ts`
- Modify: `tests/integration/http-server.test.ts`
- Modify: `tests/integration/demo-scenarios.test.ts`
- Regenerate: `docs/openapi.json`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: HTTP request/response schemas for Knowledge/versions, Reference Policy 2.0, synthetic capability availability, and final end-to-end fixtures.

- [ ] **Step 1: Write failing API and vertical-slice tests**

```ts
test('returns review when CPU support knowledge is absent', async () => {
  const response = await requestCompatibility(syntheticInput({ knowledgeSnapshots: [] }));
  expect(response.resultSnapshot).toMatchObject({ decision: 'REVIEW' });
});

test('blocks a known insufficient BIOS on the full synthetic flow', async () => {
  const response = await requestCompatibility(syntheticInsufficientBiosInput());
  expect(response.resultSnapshot.issues.blockingRuleIds).toContain('minimum-bios');
});
```

Add HTTP/schema tests for provider version differences, stale snapshot coexistence, missing provenance rejection, CPU relation ambiguity, PSU four-way outcomes, all Exact Evidence edges, disabled → `NOT_CHECKED`, and no provider-specific extension keys or business fields in public compatibility output. Generic provenance fields declared by Knowledge Snapshot remain available for replay.

- [ ] **Step 2: Run RED integration tests**

Run: `corepack pnpm exec vitest run packages/api-contracts/test tests/integration/reference-api.test.ts tests/integration/http-server.test.ts tests/integration/demo-scenarios.test.ts`

Expected: FAIL because shared DTOs and Reference composition still expose v0.1 shapes and rules.

- [ ] **Step 3: Implement synthetic composition**

Add `cpuSupportRule`, `minimumBiosRule`, `psuFormFactorRule`, and `exactFieldEvidenceRule` to the Reference engine. Set `cpu-support`, `bios`, `psu-form-factor`, and `exact-field-evidence` to REQUIRED in Reference Policy 2.0; leave `qvl` DISABLED. Remove the separate demo call to `applyExactFieldEvidence`; display the EngineRule result instead.

At the HTTP boundary, allow omitted `knowledgeSnapshots` and normalize it to `[]`. Validate present snapshots with Core and validate the Field Evidence v4 envelope with Evidence before rule execution. Generate every fixture locally with `example.invalid` source URIs and synthetic part IDs.

- [ ] **Step 4: Regenerate OpenAPI and run GREEN integration**

Run: `corepack pnpm docs:openapi`

Run: `corepack pnpm exec vitest run packages/api-contracts/test tests/integration/reference-api.test.ts tests/integration/http-server.test.ts tests/integration/demo-scenarios.test.ts`

Expected: PASS; regenerated OpenAPI is deterministic and contains Knowledge Snapshot 1.0 and Result Snapshot 3.0 fields.

- [ ] **Step 5: Run package and consumer regression**

Run: `corepack pnpm typecheck`

Run: `corepack pnpm build`

Run: `corepack pnpm test:integration`

Expected: PASS on Ubuntu and Windows paths.

- [ ] **Step 6: Self-review and commit**

```bash
git add packages/api-contracts packages/demo-data apps/reference-api tests/integration docs/openapi.json
git commit -m "feat(api): expose v0.2 compatibility knowledge flow"
```

### Task 11: Version, document, and gate the v0.2.0 release candidate

**Purpose:** Align independent contract versions, package Changesets, public docs, portability, and release evidence without publishing.

**Files:**
- Modify: root `package.json`
- Modify: affected `packages/*/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/check-versions.mjs`
- Modify: `scripts/release-tooling.test.ts`
- Create and consume with Changesets: `.changeset/<generated-descriptive-name>.md`
- Create: `docs/KNOWLEDGE-SNAPSHOT.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/RULE-ENGINE.md`
- Modify: `docs/FIELD-EVIDENCE.md`
- Modify: `docs/EVIDENCE-MODEL.md`
- Modify: `docs/PROVIDER-SDK.md`
- Modify: `docs/providers/future-manufacturer-contracts.md`
- Modify: `docs/API.md`
- Modify: `docs/VERSIONING.md`
- Modify: `docs/ROADMAP.md`
- Modify: `HANDOFF.md` once after final verification

**Interfaces:**
- Consumes: the final contract versions in this plan.
- Produces: consistent package/runtime/snapshot metadata and a release-ready, unpublished v0.2.0 branch.

- [ ] **Step 1: Write failing version and documentation tests**

```js
const expectedContracts = {
  engine: '0.2.0', canonicalSchema: '3.1.0', installationContext: '2.1.0',
  knowledgeSnapshot: '1.0.0', fieldEvidence: '4.0.0', evidencePolicy: '1.0.0',
  snapshot: '3.0.0', ruleSet: '0.2.0', referencePolicy: '2.0.0',
  identityMapper: '1.1.0', providerAdapter: '3.0.0',
};
```

Add checks that final package versions match the approved explicit map, unchanged package versions are not raised without a contract/dependency change, and docs contain no live-source instructions or retailer-specific fields.

The expected manifest map is `0.2.0` for direct-contract packages (`core`, `evidence`, `provider-sdk`, `rules-standard`, `api-contracts`, `demo-data`, `similarity`) and `0.1.1` for packages whose only release change is an updated internal dependency (`http-server`, `identity`, `llm-toolkit`, `power`, `provider-buildcores`, `storage-sqlite`, `unit-normalization`). If Changesets computes a different map, stop and reconcile the dependency graph before editing the checker.

- [ ] **Step 2: Run RED contract checks**

Run: `corepack pnpm version:check`

Run: `corepack pnpm docs:check-links`

Expected: FAIL until constants, manifests, snapshots, Changesets, and docs agree.

- [ ] **Step 3: Compute exact package versions and update documentation**

Create Changeset entries for the seven direct-contract packages, run `corepack pnpm changeset status --output <temporary-path>`, and inspect the computed release plan. It must match the approved direct and dependency-only map. Then run `corepack pnpm changeset version` to update/consume the pending Changesets, package manifests, internal dependency ranges, lockfile, and generated package changelogs. Update the private root version separately to `0.2.0`; do not hand-edit transitive public-package versions.

Document the Knowledge supersession/provenance model, BIOS ordinal rule, CPU/BIOS/PSU status tables, Exact/Similar boundary, replay incompatibility with Snapshot 2.0, and HMY integration sequence:

```text
PCPartCheck v0.2.0 tag and exact release SHA
→ separately approved HMY-PCPartCheck engine pin update
→ compatibility adapter integration
```

Do not add tag creation, npm publishing, deployment, or product-repository edits.

- [ ] **Step 4: Run focused and full local verification**

Run in order:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check:deps
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm build
corepack pnpm docs:openapi
corepack pnpm docs:check-links
corepack pnpm version:check
corepack pnpm pack:check
```

Expected: all commands PASS and generated artifacts have no second-run diff.

- [ ] **Step 5: Self-review and commit the release candidate**

Review all public exports and generated OpenAPI, scan for source-specific names/data, confirm `v0.1.0` is untouched, and confirm the worktree is clean after this commit. Do not update HANDOFF with unobserved remote results.

```bash
git add package.json pnpm-lock.yaml packages apps scripts .changeset docs README.md CHANGELOG.md
git commit -m "docs: prepare PCPartCheck v0.2.0 release contract"
```

- [ ] **Step 6: Run remote CI on the exact candidate commit**

Required Ubuntu jobs: frozen install, dependency graph, typecheck, lint, unit, integration, build, docs/OpenAPI determinism, version, package pack checks.

Required Windows jobs: frozen install, dependency graph, typecheck, lint, unit, integration, build, path/shell portability, version checks.

Expected: Ubuntu PASS and Windows PASS at the same candidate commit SHA. No external catalog request is made.

- [ ] **Step 7: Record observed closure once and verify the final HEAD**

Update HANDOFF once with the candidate SHA and observed local/remote results, then commit it. Run the repository's required CI on that final docs commit too; Phase 3 is complete only when the final branch HEAD has the required green checks. If remote CI cannot run, report `Needs verification` and do not claim completion.

```bash
git add HANDOFF.md
git commit -m "docs: record PCPartCheck v0.2.0 verification"
```

## Risks, decisions, and open questions

- **Opaque BIOS versions:** Resolved by provider-issued `releaseOrdinal` and exact installed-version lookup. If a provider cannot supply a unique release record, the rule returns `REVIEW_REQUIRED`.
- **Conflicting providers:** Resolved by conflict status. v0.2.0 has no trust score or provider precedence.
- **Stale snapshots:** Resolved by explicit same-provider supersession and active leaves; cycles and ambiguous leaves are errors/conflicts.
- **Sparse hardware revisions:** Missing a revision required by a relation or Exact Evidence scope yields `UNKNOWN`/non-exact, increasing reviews rather than guessing.
- **Evidence migration:** Field Evidence 3.0 remains an immutable historical format. v4 records are created for v0.2 decisions; no destructive in-place rewrite is planned.
- **Old replay:** Snapshot 2.0 is replayed by v0.1.0. v0.2.0 intentionally rejects it because Knowledge and Evidence policy inputs were not recorded.
- **Package version fan-out:** Changesets and an explicit per-package map prevent unrelated public packages from being raised solely to match the engine tag.
- **Future QVL:** The discriminated relation union and source/provenance envelope are reusable, but v0.2.0 does not define QVL decisions.
- **Open questions:** No blocking design question remains in this proposal. User approval of the deliberate serialized-version boundaries and equal-authority multi-provider conflict policy is required before Task 1.

## Recommended implementation order

1. Task 1 establishes representable runtime and missing-data facts.
2. Tasks 2–3 establish immutable Knowledge and engine replay boundaries.
3. Task 4 establishes provider production without a live provider.
4. Tasks 5–7 add independently reviewable CPU, BIOS, and PSU rules.
5. Tasks 8–9 harden Exact Evidence and integrate it through the existing aggregator.
6. Task 10 proves the complete synthetic public flow.
7. Task 11 aligns versions, docs, package artifacts, candidate/final commits, and remote CI.

Each task follows RED → observed RED → minimal GREEN → focused tests → affected regression → self-review → commit. Do not start the next task until the current task is committed and clean.

## Stop gate

This document authorizes planning only. Do not begin Task 1, create an implementation branch, modify HMY-PCPartCheck, alter its engine pin, publish v0.2.0, or deploy. Implementation starts only after user review and explicit approval.
