# Versioning

PCPartCheck에는 서로 다른 수명 주기를 가진 계약이 있습니다. 모든 숫자를 하나로 맞추면 어떤 의미가 바뀌었는지 알 수 없으므로 각 domain을 따로 올립니다.

## 현재 버전

| Domain | Version | 위치 |
|---|---:|---|
| 공개 package / Engine | `0.1.0` | 각 `package.json`, `ENGINE_VERSION` |
| Canonical Schema | `3.0.0` | `CANONICAL_SCHEMA_VERSION` |
| Installation Context | `2.0.0` | `INSTALLATION_CONTEXT_SCHEMA_VERSION` |
| Field Evidence | `3.0.0` | `FIELD_EVIDENCE_SCHEMA_VERSION` |
| Result Snapshot | `2.0.0` | `SNAPSHOT_FORMAT_VERSION` |
| Standard RuleSet | `0.1.0` | `STANDARD_RULE_SET_VERSION` |
| Identity Mapper | `1.1.0` | `IDENTITY_MAPPER_VERSION` |
| BuildCores Adapter | `3.0.0` | `BUILDCORES_MAPPER_VERSION` |
| Reference Policy | `1.0.0` | `REFERENCE_POLICY_VERSION` |

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

Result Snapshot은 실행 시점의 Engine, RuleSet, Policy, Canonical, Installation Context, Identity Mapper, Provider version을 보존합니다. Replay는 현재 runtime과 기록값이 다르면 실행을 중단합니다. version mismatch를 무시하고 과거 결과를 현재 의미로 해석하는 옵션은 두지 않습니다.

## Changesets와 npm

공개 package 변경은 Changeset으로 release note와 package bump를 준비합니다. 현재 `@pcpartcheck` npm scope 소유권을 확인하지 않았으므로 publish workflow, `NPM_TOKEN`, 자동 tag/Release는 없습니다. `v0.1.0` tag와 GitHub Release도 최종 승인 뒤 사람이 실행합니다.

`corepack pnpm version:check`는 package manifest, runtime constant, public export, Reference Snapshot metadata가 위 표와 맞는지 검사합니다.
