# PHASE 5 구현 계획

이 문서는 승인된 24개 Task와 Commit 경계를 저장소 안에서 추적하기 위한 기준표다. 구현은 Checkpoint별로 멈추며, 다음 Checkpoint는 검토를 받은 뒤 시작한다.

## Checkpoint 1 — Foundation/Core

1. Monorepo, CI, dependency graph 검사 — `chore: bootstrap monorepo and CI`
2. Canonical Spec Schema와 구조화 subtype — `feat(core): define canonical spec schema`
3. Raw Evidence와 Unit Normalization — `feat(evidence): add raw evidence and unit normalization`
4. Capability, Policy, Rule Contract — `feat(core): add capability policy and rule contracts`
5. Status, Decision, Coverage 집계 — `feat(core): aggregate compatibility results`
6. Build Intent와 InstallationContext — `feat(core): add build intent and installation context`
7. Engine과 재현 가능한 Result Snapshot — `feat(core): add compatibility engine and snapshots`

## Checkpoint 2 — Compatibility Logic

8. Socket, Memory, Form Factor Rule — `feat(rules): add platform compatibility rules`
9. Clearance와 Cooling Rule — `feat(rules): add clearance and cooling rules`
10. Storage와 Platform Rule — `feat(rules): add storage compatibility rules`
11. Power Budget와 Power Delivery — `feat(power): add deterministic power evaluation`
12. Fan, RGB, Memory Advisory Rule — `feat(rules): add header and memory advisory rules`
13. Canonical Identity Mapping — `feat(identity): add deterministic identity mapping`
14. Exact Field Evidence — `feat(evidence): apply exact field evidence`
15. Deterministic Similarity — `feat(similarity): rank similar field evidence`

## Checkpoint 3 — Data/API/Demo

16. SQLite와 Drizzle 저장소 — `feat(storage): add sqlite persistence`
17. BuildCores snapshot importer — `feat(provider): add buildcores snapshot importer`
18. Optional LLM toolkit — `feat(llm): add advisory llm toolkit`
19. API Contracts와 Fastify reference server — `feat(api): add shared contracts and http server`
20. Synthetic demo data — `feat(demo): add synthetic compatibility scenarios`
21. Next.js demo와 Playwright — `feat(demo): add interactive demo site`

## Checkpoint 4 — Public Release Quality

22. README, 문서, 다이어그램, 실제 화면 캡처 — `docs: add public project documentation`
23. SemVer, Changesets, release workflow — `chore: add versioning and release workflow`
24. Docker와 최종 검증 — `chore: add docker packaging and release checks`

## 고정 Contract

- `core`는 다른 `@pcpartcheck/*` 패키지를 import하지 않는다. 의존성 화살표는 사용하는 쪽에서 제공하는 쪽을 향한다.
- Rule은 versioned Canonical Spec만 읽는다. Provider의 raw field는 Rule 입력이 아니다.
- 메모리 전송률은 `dataRateMtps`로 저장한다. 실제 clock만 `clockMHz`로 표현한다.
- `CapabilityPolicy`는 `REQUIRED`, `ADVISORY`, `DISABLED` 중 한 가지 `mode`만 가진다.
- `REQUIRED INCOMPATIBLE`은 `BLOCK`, `ADVISORY INCOMPATIBLE`은 `ALLOW_WITH_WARNING`으로 집계한다.
- Coverage의 원본 데이터는 Required와 Advisory별 `total`, `evaluated`, `unknown`, `notChecked`다. 비율은 UI에서만 계산한다.
- `InstalledRadiator.sizeMm`은 양의 정수다. 지원 규격은 `RadiatorMountSpec.supportedSizesMm`과 Rule이 판단한다.
- BuildCores의 `RAM.speed` 해석은 BuildCores Adapter 전용 `SOURCE_SEMANTIC_ALIAS`다. UnitNormalizer의 일반 변환 규칙에 넣지 않는다.
- 정보가 부족한 판정은 `UNKNOWN`으로 남긴다. LLM은 deterministic validation 결과를 바꿀 수 없다.
- Result Snapshot은 엔진, Rule Set, Policy, Canonical Schema, Identity Mapper, Provider 버전과 입력·Evidence·결과를 함께 보존한다.
