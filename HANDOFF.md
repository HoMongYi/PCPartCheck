# PCPartCheck 작업 인계

## 현재 상태

`feat/checkpoint-1-foundation` 브랜치에서 Checkpoint 3.5의 Correctness & Public Contract Hardening을 마쳤다. 구현 커밋은 원격 feature branch에 push했고 merge하지 않았다. Checkpoint 4는 시작하지 않은 채 사용자 검토를 기다린다.

Canonical Schema는 PCIe 슬롯의 physical/electrical lane 분리, Consumer 전원 요구 구조, `PCIE_CARD` 복원을 반영해 `2.0.0`이다. 엔진과 패키지 버전은 `0.1.0`을 유지한다. 이전 Canonical Schema Snapshot은 replay할 때 `ReplayVersionMismatchError`가 발생한다.

## 이번에 정리한 Contract

- External Mapping은 `CONFIRMED`만 자동 재사용한다. `REVIEW_REQUIRED`와 `REJECTED`는 그대로 유지하며, 확정 Mapping이라도 incoming identity의 category나 critical field가 심각하게 충돌하면 자동 재사용하지 않는다.
- PCIe 슬롯은 `physicalLanes`, `electricalLanes`, `generation`, `positionIndex`를 따로 가진다. 물리 장착 가능 여부와 대역폭 경고도 서로 다른 Rule이 맡는다.
- GPU와 `PCIE_CARD`의 최대 link width는 필수 electrical lane 수가 아니다. 낮은 electrical lane이나 세대는 호환 불가가 아니라 Advisory 경고로 처리한다.
- Consumer 전원 요구는 `REQUIRED / OPTIONAL / CONDITIONAL`로 구분한다. 고전력 커넥터 Adapter는 입력 커넥터 수가 기술 자료에 명시된 경우에만 판정한다.
- LLM은 실제 Rule에 연결된 보충 설명만 반환할 수 있다. 전체 Status, Decision, 판정 제목, blocking/review/advisory 구분은 결정론적 계층이 계속 소유한다.
- Field Evidence는 `visibility: PUBLIC / STAFF_ONLY / ADMIN_ONLY`와 `redaction: NONE / ANONYMIZED`를 별도 필드로 가진다. 새 기록은 반드시 `DRAFT`로 시작하며 승인에는 별도 권한이 필요하다.
- Similar Failure는 계속 참고 Evidence만 만든다. Compatibility Status나 Decision을 변경하지 않는다.

## BuildCores 범위

2026-09-08에 공식 저장소의 최신 main `547b32703b370142f17b09c3047c80dc88ba5260`과 Schema tree `cc15acdcf8cec85d36b267fd6c201eff754cf624`를 다시 확인했다.

- 지원: CPU, Motherboard, RAM, GPU, PCCase, PSU, Storage
- 조건부 지원: CPUCooler. 수랭 제품은 radiator size가 있어 AIO로 확정할 수 있을 때만 import한다.
- Skip: CaseFan. Canonical 필수 값인 `thicknessMm`가 원본 Schema에 없다.

메인보드 PCIe의 physical/electrical 의미, 추가 EPS의 필수 여부, Fan header connector/current처럼 원본만으로 확정할 수 없는 값은 비워 둔다. GPU TDP를 peak power로 바꾸거나 interface의 x값을 physical connector로 추정하지 않는다. RAM `speed`만 BuildCores Adapter 안에서 `SOURCE_SEMANTIC_ALIAS`로 `dataRateMtps`에 옮기며 원본 field/unit, mapping rule, mapper version을 Audit에 남긴다.

자세한 표는 `docs/providers/buildcores.md`에 있다.

## 공개 API

- `GET /health`
- `POST /v1/compatibility/check`
- `POST /v1/compatibility/check-batch`
- `GET /v1/parts`
- `GET /v1/parts/:id`
- `GET /v1/evidence/:id`
- `GET /v1/field-evidence/similar`
- `GET /v1/capabilities`
- `GET /v1/profiles`
- `POST /v1/field-evidence`
- `PATCH /v1/field-evidence/:id`
- `POST /v1/field-evidence/:id/approve`
- `GET /v1/demo`
- `GET /openapi.json`
- `GET /docs/`

공개 전 API 이름을 정리해 `/v1/checks`와 `/v1/evidence/similar`는 남기지 않았다. Field Evidence 읽기·쓰기·승인 권한은 `AuthorizationProvider`, 요청 제한은 `RateLimitProvider`가 맡는다. 메모리 기반 reference 구현은 401/403, 429와 `Retry-After`까지 통합 테스트로 확인했다. Core는 인증과 Rate Limit 구현에 의존하지 않는다.

Result Snapshot의 versions, providerVersions, inputSnapshot, Status, Decision, coverage, issue groups, rule results는 구체적인 OpenAPI runtime schema로 노출한다. `Type.Any()`는 재귀 JsonValue를 여러 번 인라인할 때 생기는 TypeBox `$ref` 충돌 때문에 API 경계의 `customFacts`, capability `config`, `evidenceSnapshot`, Raw Evidence `rawValue`에만 공통으로 사용한다. Compatibility 입력은 엔진 진입 시 Core의 `JsonValueSchema`로 다시 검증한다.

## Demo

Dashboard는 8개 합성 시나리오를 실제 엔진으로 계산한다.

- `PASS / ALLOW`
- Socket, radiator/GPU, PSU connector의 `INCOMPATIBLE / BLOCK`
- Advisory RGB 실패의 `INCOMPATIBLE / ALLOW_WITH_WARNING`
- 누락된 clearance의 `UNKNOWN / REVIEW`
- 최소 출력과 최종 권장 출력 사이 PSU의 `WARNING / ALLOW_WITH_WARNING`
- disabled Capability의 `NOT_CHECKED / NO_DECISION`

각 카드의 상세 영역에서 Rule 결과, Required/Advisory/Disabled coverage, Capability mode를 볼 수 있다. Power Budget 사례는 estimated peak, minimum, calculated recommendation, final recommendation, 선택한 PSU 정격을 함께 표시한다. 승인된 Exact Failure와 Similar Top 3는 별도 영역으로 나눴고, Similar 사례는 현재 구성을 자동 차단하지 않는다고 명시했다.

Demo의 API 문서 링크는 `PCPARTCHECK_PUBLIC_API_URL`로 바꿀 수 있고 기본값은 상대 경로 `/docs/`다. 서버 측 Dashboard 조회 주소는 `PCPARTCHECK_API_URL`을 사용하며 로컬 주소를 소스에 고정하지 않는다.

## Commit 경계

- `366ac29 fix(identity): respect mapping review status`
- `6c33a67 fix(core): separate PCIe and power semantics`
- `93167f3 fix(llm): scope explanations to rule results`
- `238959d feat(provider): complete verified BuildCores coverage`
- `c88c61e feat(evidence): add access and redaction contract`
- `a691b4a feat(api): restore generic public contract`
- `87e5833 feat(demo): expose rule and evidence details`
- `670151c fix(api): preserve evidence approval boundary`

## 검증 결과

- Passed — `corepack pnpm check:deps`
- Passed — `corepack pnpm typecheck`
- Passed — `corepack pnpm lint`
- Passed — `corepack pnpm test:unit`, 17개 파일 154건
- Passed — `corepack pnpm test:integration`, 4개 파일 27건
- Passed — `corepack pnpm build`, 전체 패키지와 앱 production build
- Passed — `corepack pnpm test:e2e`, desktop/mobile Chromium 2건
- Passed — GitHub Actions run `34241865070`, Ubuntu 1분 22초·Windows 2분 12초
- Needs verification — 이 HANDOFF 문서만 추가한 최종 commit의 GitHub Actions

## 남은 데이터 한계와 위험

- BuildCores의 모호하거나 누락된 필드는 Canonical 값을 만들지 않는다. 해당 Rule은 데이터가 보강될 때까지 `UNKNOWN`을 반환한다.
- CaseFan은 두께가 없어 import할 수 없다. Motherboard PCIe lane 의미와 추가 EPS 필수 여부도 원본 Schema만으로는 확정할 수 없다.
- Field Evidence authorization과 Rate Limit은 provider contract와 메모리 reference 구현까지만 제공한다. 실제 계정·직급·분산 저장소 연동은 Consumer 책임이다.
- Similarity 가중치는 합성 Fixture에서 결정론만 확인했다. 실제 Evidence가 쌓이면 issue별 보정이 필요하다.
- Demo와 Reference API의 공개 배포·reverse proxy·Docker 구성은 Checkpoint 4 범위다.

## 다음 작업

사용자 승인 전에는 Checkpoint 4를 시작하지 않는다. 승인받으면 Task 22~24의 README, 문서, 아키텍처 다이어그램, 실제 Demo Screenshot, OpenAPI 정리, Attribution, Changesets/SemVer, Docker와 최종 검증만 진행한다.
