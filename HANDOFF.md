# PCPartCheck 작업 인계

## 현재 상태 — Phase 3 / v0.2.0 release candidate

- 구현 branch: `feat/phase-3-pcpartcheck-v0.2`
- 구현 base/main 계획 SHA: `35479978e7c42714703f848ac9e734f324d4fa37`
- 계획: `docs/superpowers/plans/2026-09-20-pcpartcheck-v0.2-design-implementation-plan.md`
- Task 1~11 구현과 release-candidate 준비는 완료했다.
- 검증된 candidate SHA: `4fd63a3e7cfd0b9e677c95956b6686463f06a9a8`
- candidate CI: GitHub Actions run `35516765677`, exact head SHA 일치, Windows/Ubuntu/Docker runtime 모두 PASS.
- 이 문서는 계획에서 허용한 유일한 post-candidate HANDOFF 갱신이다. 이 문서를 기록하는 최종 commit 자체가 같은 required CI를 통과해야 Phase 3 구현 종료를 확정할 수 있다.
- main merge, `v0.2.0` tag/GitHub Release/npm publish, deployment, HMY-PCPartCheck engine pin 변경은 시작하지 않았다.

## Task commits

- Task 1: `9edcf5d2e4c59eef5ce5292a28587149e9dd0bad` — PSU와 component revision의 unknown 표현
- Task 2: `646ebcfdc5db06d4bc699aa36213bed5818eccfe` — provider-neutral Knowledge Snapshot
- Task 3: `224dc49af09d818054e652517ddf7e19a5386415` — Knowledge/Evidence replay input snapshot
- Task 4: `5c00aafcb50bb81c0bb4eedec3acc3e7e4248aea` — Knowledge Snapshot Provider SDK
- Task 5: `a62d08b23e68e4a65bd991fff13ddbb5d685f70e` — CPU support resolution/rule
- Task 6: `45dbf8a08146155e4b103e00fac9cdd0ef7a1823` — minimum BIOS resolution/rule
- Task 7: `f935f7e62d9efc7457c55be19d4e592c9c9ec11c` — Case/PSU form-factor rule
- Task 8: `9afed45cf10f2f4b1ebdde90527dd281b31da17e` — revision-aware Exact Evidence
- Task 9: `1e402f1ad5fba13bc5b6e12b3326311c342b9dcb` — Exact Evidence engine orchestration
- Task 10: `24177e91b579d9d594da8c2554c42cc3d57da41b` — public DTO, synthetic composition, Reference Policy 2.0
- Task 11 candidate: `35829840fe920136e2c9aa1d27f3553cf21e9029` — version, package, docs, release contract
- Task 11 CI repair: `4fd63a3e7cfd0b9e677c95956b6686463f06a9a8` — 12-scenario E2E contract와 v0.2 runtime markers

## 공개 Version Contract

- Engine/root: `0.2.0`
- Canonical Schema: `3.1.0`
- Installation Context: `2.1.0`
- Knowledge Snapshot: `1.0.0`
- Field Evidence: `4.0.0` (historical read: `3.0.0`)
- Evidence Policy: `1.0.0`
- Result Snapshot: `3.0.0`
- Standard RuleSet: `0.2.0`
- Reference Policy: `2.0.0`
- Identity Mapper: `1.1.0`
- BuildCores Adapter: `3.0.0`

각 version은 독립 domain이다. `version:check`가 package manifests, runtime constants, public exports, release metadata와 Reference composition을 함께 검증한다.

## Package versions

- Direct-contract `0.2.0`: `api-contracts`, `core`, `demo-data`, `evidence`, `provider-sdk`, `rules-standard`, `similarity`
- Dependency-only `0.1.1`: `http-server`, `identity`, `llm-toolkit`, `power`, `provider-buildcores`, `storage-sqlite`, `unit-normalization`
- Private apps 유지 `0.1.0`: `reference-api`, `demo-web`
- Changesets가 위 map에 맞춰 manifests, internal dependency ranges, lockfile, package changelogs를 갱신했고 pending changeset을 소비했다.
- 공개 package 14개의 dry-run pack과 built-package consumer import smoke가 PASS했다.

## 구현 계약

- Knowledge Snapshot은 provider/version, `collectedAt`, source provenance, CPU support/BIOS relations와 동일-provider supersession을 immutable replay input으로 보존한다.
- Canonicalization은 결정론적으로 정렬하고 dangling/cross-provider/self/cyclic supersession과 유효하지 않은 provenance/reference를 거부한다.
- CPU support는 `SUPPORTED`, `UNSUPPORTED`, `MISSING`, `CONFLICT`를 구분한다. missing은 `UNKNOWN`, conflict는 `REVIEW_REQUIRED`이며 provider 이름, confidence, 최신 시각으로 승자를 고르지 않는다.
- Minimum BIOS는 `NONE`, `UNKNOWN`, `MINIMUM`을 구분하고 provider-issued `releaseOrdinal`만 비교한다. BIOS 문자열을 lexical/version parsing으로 추측하지 않는다.
- Case/PSU form factor는 literal membership만 평가한다. 누락은 `UNKNOWN`이며 alias, 치수, 제조사 예외를 추론하지 않는다.
- Field Evidence 4.0은 complete part scope, hardware revisions, installed BIOS와 issue material context가 모두 일치할 때만 `EXACT`다. Similar Evidence는 Status/Decision에 영향을 주지 않는다.
- Active approved Exact Evidence만 일반 EngineRule로 집계한다. outcome/supersession ambiguity는 `REVIEW_REQUIRED`; deterministic failure는 exact success로 덮지 않는다.
- Result Snapshot 3.0은 normalized Knowledge/Evidence와 policy versions를 보존한다. v0.2 runtime은 사실을 복원할 수 없는 Snapshot 2.0 replay를 명시적으로 거부한다.
- Reference Policy 2.0은 `cpu-support`, `bios`, `psu-form-factor`, `exact-field-evidence`를 REQUIRED로 실행하고 `qvl`은 DISABLED로 유지한다.
- Reference API/Demo는 12개 synthetic scenario를 실제 engine으로 실행한다. 별도 Evidence post-processing이나 두 번째 decision engine은 없다.

## 검증 결과

- Candidate CI run `35516765677` / SHA `4fd63a3e7cfd0b9e677c95956b6686463f06a9a8`: PASS.
- Ubuntu: frozen install, dependency boundaries, typecheck, lint, unit, integration, build, OpenAPI generation/diff, docs, version, pack, Chromium Playwright PASS.
- Windows: 같은 verify gate와 Chromium Playwright PASS.
- Docker runtime: Compose validation/image build/up, API/Web health, runtime endpoints, container-targeted Playwright, volume/orphan cleanup PASS.
- Integration suite: 48 tests PASS.
- Browser E2E: desktop/mobile Chromium 2 tests PASS.
- Candidate OpenAPI deterministic SHA-256: `EACF7301CEF4155E0FD535658E6E30B2AD0F80C8E302FEB303C52F172C644A39`.
- 첫 candidate run `35516377995`는 domain 구현이 아니라 이전 8-scenario/3-BLOCK E2E 기대값 때문에 실패했다. API 계약의 12 scenarios/5 BLOCK과 Demo `ENGINE 0.2.0 · RULESET 0.2.0` marker를 맞춘 뒤 run `35516765677`에서 세 job이 모두 통과했다.
- v0.1.0 annotated tag target `e28d542ab2db5ce5d8294fe96add8942047f4a66`과 그 history는 변경하지 않았다.

## Clean-room / network boundary

- 모든 신규 fixture와 vertical slice는 provider-neutral synthetic ID와 `example.invalid` provenance만 사용한다.
- live manufacturer, retailer, BuildCores, QVL, BIOS, catalog network access: `0`.
- 실제 retailer 상품 식별자, URL, 가격, 재고, 주문/고객 데이터: `0`.
- Compuzone-specific code/data와 HMY-PartFit 참조/재사용: `0`.
- HMY-PCPartCheck 변경: `0`; 확인된 HEAD는 `522345ba0e2583eba2179daea6ca6aeb1c5c66e0`, working tree clean.

## 남은 제약과 다음 단계

- 실제 manufacturer CPU support/BIOS/QVL provider, QVL decisions, production persistence, auth/rate limit, Attachment Storage, admin/product UI는 구현하지 않았다.
- BuildCores에 없는 M.2 key/sharing, PCIe physical/electrical, additional EPS, fan thickness 사실은 추측하지 않는다.
- 현재 release candidate는 unpublished 상태다.
- 다음 허용 단계는 이 HANDOFF closure commit을 push한 뒤 exact final HEAD에서 Windows/Ubuntu/Docker CI를 다시 통과시키는 것이다.
- 그 이후의 main merge, tag/release/publish, deployment, HMY-PCPartCheck pin update는 각각 별도 승인 전까지 금지한다.
