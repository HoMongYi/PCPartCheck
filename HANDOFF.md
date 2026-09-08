# PCPartCheck 작업 인계

## 현재 상태

`feat/checkpoint-1-foundation` 브랜치에서 Pre-Checkpoint 정리와 Checkpoint 3의 Task 16~21을 마쳤다. 구현 내용은 원격 feature branch에 push했으며 merge하지 않았다. Checkpoint 4는 시작하지 않고 사용자 검토를 기다린다.

Canonical Schema는 `PsuSpec.lengthMm` 추가 이력을 반영해 `1.1.0`이다. 패키지와 엔진 버전은 계획대로 `0.1.0`을 유지한다. 이전 `1.0.0` Snapshot은 Replay할 때 `ReplayVersionMismatchError`가 발생하고, 새 Snapshot에는 `canonicalSchemaVersion: 1.1.0`이 기록된다.

## 구현한 범위

- Drizzle 기반 SQLite 저장소와 실제 migration
- Canonical Part, External Mapping, Raw/Field Evidence, Result Snapshot 영속화와 round-trip
- 로컬 BuildCores Snapshot importer와 CPU/RAM Canonical Adapter
- 설명과 식별 후보 정렬만 맡는 선택형 LLM Toolkit
- 공유 `api-contracts`, Fastify 서버, 실행 가능한 Reference API
- 실제 엔진으로 판정하는 합성 조립 시나리오 6개
- Reference API 데이터를 읽는 Next.js 데모와 데스크톱·모바일 Playwright E2E

Similar Failure는 계속 참고 Evidence만 만든다. API는 `evidenceId`, `issueType`, `similarityScore`, `matchedFields`, `differences`, `reason`을 반환하지만 Compatibility Status나 Decision은 만들지 않는다. 데모에도 유사 사례가 현재 구성의 호환 불가를 뜻하지 않는다는 문구를 명시했다.

## Commit 경계

- `7919fd6 fix(core): version canonical schema 1.1.0`
- `492cab9 ci: verify feature branches`
- `c5b010a fix(ci): remove unsupported setup input`
- `2fe051a feat(storage): add sqlite persistence`
- `208db0f feat(provider): add buildcores snapshot importer`
- `fff229e feat(llm): add advisory llm toolkit`
- `db1b681 feat(api): add shared contracts and http server`
- `0adc571 feat(demo): add engine-backed synthetic scenarios`
- `083ee8e feat(web): add compatibility demo dashboard`

## 검증 결과

- Passed — `corepack pnpm check:deps`
- Passed — `corepack pnpm typecheck`
- Passed — `corepack pnpm lint`
- Passed — `corepack pnpm test:unit`, 17개 파일 125건
- Passed — `corepack pnpm test:integration`, 4개 파일 19건
- Passed — `corepack pnpm build`, 전체 패키지와 앱 production build
- Passed — `corepack pnpm test:e2e`, desktop/mobile Chromium 2건
- Passed — GitHub Actions run `34171673602`, Ubuntu 1분 14초·Windows 2분 34초

GitHub Actions는 두 운영체제에서 install, dependency graph, typecheck, lint, unit, integration, build를 실행한다. 이어서 해당 운영체제용 Chromium을 설치하고 실제 Reference API와 production Next.js 서버를 대상으로 E2E도 실행한다.

## Task별 확인 사항

### Task 16 — SQLite + Drizzle

Migration과 저장소 통합 테스트 5건이 통과했다. 새 데이터베이스의 테이블 생성, Canonical Part upsert, 기존 External Mapping의 `partId` 유지, Raw/Field Evidence round-trip, Result Snapshot round-trip을 확인했다. External Mapping이 가리키는 `partId`를 다른 값으로 바꾸는 upsert는 거부한다.

### Task 17 — BuildCores Snapshot Provider

구현 직전에 공식 `buildcores/buildcores-open-db`의 현재 구조를 다시 확인했다. 확인 당시 main commit은 `a3795382f9e73c283e3592a8c972842fd0e72e22`였고, 조사 때보다 자동 데이터 동기화 commit만 갱신됐다. `/open-db/{category}/{UUID}.json`, `/schemas`, `opendb_id`, `metadata`, `identifiers` 구조에는 큰 차이가 없었다.

RAM schema 설명은 `speed`를 MHz라고 적고 있지만, 실제 표본은 제품명의 DDR5-6400과 `speed: 6400`이 일치했다. 이 값은 시장 표기 DDR data rate로 확인해 BuildCores Adapter 안에서만 `dataRateMtps`로 옮겼다. Audit에는 원본 field와 `MHz` 표기, `SOURCE_SEMANTIC_ALIAS`, mapping rule, mapper version을 남긴다. Core와 Unit Normalizer에는 MHz→MT/s 변환을 추가하지 않았다.

Fixture 결과는 import 2건, failed 1건, skipped 1건이다. CPU의 `ppt`와 `tdp`는 W 단위 Canonical 값으로 정규화했고, RAM의 semantic alias를 별도로 검증했다. 기존 External Mapping이 있으면 같은 Canonical UUID를 재사용한다. 지원하지 않는 카테고리는 `SKIPPED`, 필수 식별 정보가 잘못된 레코드는 `FAILED`다.

BuildCores 출처와 ODC-By 1.0 조건, 확인한 commit/tree는 `ATTRIBUTION.md`와 `docs/providers/buildcores.md`에 기록했다.

### Task 18 — Optional LLM Toolkit

테스트 5건이 통과했다. Adapter가 입력 객체를 바꾸거나 `INCOMPATIBLE`을 `PASS`로, `UNKNOWN`을 `PASS`로 바꾸려 해도 반환되는 deterministic 결과는 달라지지 않는다. 식별 후보도 제공된 후보 안에서만 정렬하며 상태는 항상 `REVIEW_REQUIRED`다. Adapter가 없으면 `UNAVAILABLE`, 응답이 잘못되면 `INVALID_RESPONSE`를 반환한다.

### Task 19 — API

공개 endpoint는 다음과 같다.

- `GET /health`
- `POST /v1/checks`
- `POST /v1/evidence/similar`
- `GET /v1/demo`
- `GET /openapi.json`
- `GET /docs/`

`demo-web`은 `http-server` 구현을 import하지 않고 `api-contracts` 타입만 사용한다. Fastify request validation과 OpenAPI 노출, Similar Evidence 응답에 Status/Decision이 없는 것도 통합 테스트로 확인했다.

### Task 20 — Synthetic Demo

현재 엔진에서 나온 시나리오별 결과는 다음과 같다.

- 기본 부품이 모두 맞는 구성: `PASS / ALLOW`
- CPU와 메인보드 소켓이 다른 구성: `INCOMPATIBLE / BLOCK`
- 전면 라디에이터와 그래픽카드가 겹치는 구성: `INCOMPATIBLE / BLOCK`
- 파워 용량은 충분하지만 케이블이 부족한 구성: `INCOMPATIBLE / BLOCK`
- ARGB 헤더가 맞지 않는 구성: `INCOMPATIBLE / ALLOW_WITH_WARNING`
- 그래픽카드 길이 정보가 없는 구성: `UNKNOWN / REVIEW`

승인된 Similar Failure Fixture 4건 중 점수가 높은 3건만 반환한다. 이 결과에는 Status와 Decision이 없다.

### Task 21 — Next.js Demo

Next.js 16.3.4와 React 19.2.8을 고정했다. 화면은 판정별 필터, 6개 시나리오, Similar Evidence 3건을 보여 준다. 데스크톱과 Pixel 7 기준 E2E에서 API 응답, 카드 수, 차단 필터, 면책 문구, 가로 넘침을 확인했다. production build는 `/`을 동적 서버 렌더링 경로로 만들며 정상 완료됐다.

## 계획과 달라진 점

- Reference API의 실행 진입점이 필요해 `apps/reference-api` 조합 앱을 두었다. 엔진·Rule·데모 데이터를 이 앱에서 조합하고, `http-server`는 여전히 `api-contracts`에만 의존한다.
- API의 재귀적인 `customFacts` schema를 Fastify/Ajv에 그대로 여러 번 등록하면 TypeBox `$id`가 충돌했다. HTTP 계약에서는 typed InstallationContext 필드를 그대로 유지하되 `customFacts`만 `Type.Any()`로 받고, 엔진 경계에서 Core schema로 다시 검증한다.
- Playwright 검수 캡처는 Checkpoint 4의 공개 스크린샷과 섞지 않도록 `output/playwright` 아래에 만들고 Git에서 제외했다.

Canonical Schema는 Pre-Checkpoint에서 승인된 `1.1.0`으로 올린 뒤 추가로 바꾸지 않았다. Public Contract의 breaking change도 없었다.

## 확인된 데이터 한계와 위험

- BuildCores Adapter는 실제 schema와 의미를 확인한 CPU/RAM만 지원한다. 다른 카테고리는 자료가 확인될 때까지 임의 매핑하지 않는다.
- BuildCores RAM schema의 `MHz` 설명과 실제 시장 표기 의미가 어긋난다. Provider 전용 semantic alias와 Audit 추적이 계속 필요하다.
- SQLite는 현재 단일 프로세스 Reference 구현이다. 운영 환경의 동시 쓰기, 백업, 보존 정책은 아직 범위 밖이다.
- Similarity 가중치는 합성 Fixture에서 결정론만 확인했다. 실제 Field Evidence가 쌓이면 이슈별 보정이 필요하다.
- LLM Toolkit에는 실제 외부 모델 Adapter가 없다. 이 상태에서도 모든 deterministic 검사와 테스트는 독립적으로 실행된다.
- 데모는 Reference API가 별도 프로세스로 떠 있어야 한다. 배포·Docker 구성은 Checkpoint 4 범위다.

## 다음 작업

사용자 승인 전에는 Checkpoint 4를 시작하지 않는다. 승인받으면 Task 22~24의 README·문서·아키텍처 다이어그램·실제 데모 스크린샷·OpenAPI 정리·Attribution·Changesets/SemVer·Docker·최종 검증만 진행한다.
