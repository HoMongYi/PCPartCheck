# Versioning

PCPartCheck에는 서로 다른 수명 주기를 가진 계약이 있습니다. 모든 숫자를 하나로 맞추면 어떤 의미가 바뀌었는지 알 수 없으므로 각 domain을 따로 올립니다.

## 현재 버전

| Domain | Version | 위치 |
|---|---:|---|
| Engine / direct-contract package | `0.2.0` | package map, `ENGINE_VERSION` |
| dependency-only package | `0.1.1` | package map |
| Canonical Schema | `3.1.0` | `CANONICAL_SCHEMA_VERSION` |
| Installation Context | `2.1.0` | `INSTALLATION_CONTEXT_SCHEMA_VERSION` |
| Knowledge Snapshot | `1.0.0` | `KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION` |
| Field Evidence | `4.0.0` | `FIELD_EVIDENCE_SCHEMA_VERSION` |
| Evidence Policy | `1.0.0` | `FIELD_EVIDENCE_POLICY_VERSION` |
| Result Snapshot | `3.0.0` | `SNAPSHOT_FORMAT_VERSION` |
| Standard RuleSet | `0.2.0` | `STANDARD_RULE_SET_VERSION` |
| Identity Mapper | `1.1.0` | `IDENTITY_MAPPER_VERSION` |
| BuildCores Adapter | `3.0.0` | `BUILDCORES_MAPPER_VERSION` |
| Reference Policy | `2.0.0` | `REFERENCE_POLICY_VERSION` |

Direct-contract `0.2.0`: `core`, `evidence`, `provider-sdk`, `rules-standard`, `api-contracts`, `demo-data`, `similarity`.

Dependency-only `0.1.1`: `http-server`, `identity`, `llm-toolkit`, `power`, `provider-buildcores`, `storage-sqlite`, `unit-normalization`.

Unit Normalizer와 Provider data commit도 Snapshot과 audit에서 별도 version으로 추적할 수 있지만, 위 표의 계약과 같은 번호로 묶지 않습니다.

## 올리는 기준

- 버그 수정은 영향을 받는 package patch
- 0.x 공개 package의 breaking contract는 package minor
- Canonical optional field 추가는 Canonical minor
- Canonical 의미 변경, rename, remove는 Canonical major
- Rule의 판정 동작 변경은 RuleSet version
- 기본 Policy의 mode나 판정 기준 변경은 Policy version
- 결정론적 Identity mapping 결과 변경은 Identity Mapper version
- Provider mapping 의미나 source alias 변경은 해당 Adapter version

Schema version을 올렸다는 이유만으로 package, RuleSet, Identity version을 함께 올리지 않습니다. 반대로 package 내부 버그 수정이 Canonical 의미를 바꾸지 않는다면 Canonical version은 그대로 둡니다.

## Snapshot과 Replay

Result Snapshot은 실행 시점의 Engine, RuleSet, Policy, Canonical, Installation Context, Knowledge Snapshot, Evidence Policy, Identity Mapper, Provider version을 보존합니다. Replay는 현재 runtime과 기록값이 다르면 실행을 중단합니다. Knowledge/Evidence policy 입력이 없던 Snapshot `2.0.0`은 v0.1 runtime으로 replay하며, v0.2 runtime은 명시적으로 거부합니다.

## Changesets와 npm

공개 package 변경은 Changeset으로 release note와 package bump를 준비합니다. 현재 `@pcpartcheck` npm scope 소유권을 확인하지 않았으므로 publish workflow, registry token, 자동 tag/Release는 없습니다. 기존 `v0.1.0` tag는 변경하지 않으며 `v0.2.0` tag와 release는 별도 승인 대상입니다.

`corepack pnpm version:check`는 package manifest, runtime constant, public export, Reference Snapshot metadata가 위 표와 맞는지 검사합니다.
