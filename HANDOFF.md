# PCPartCheck 작업 인계

## 현재 상태

Checkpoint 4의 Task 22~24와 Final Release Gate를 `feat/checkpoint-1-foundation` 브랜치에서 마쳤다. 공개 문서와 생성 산출물, Changesets와 version 검증, release metadata workflow, Reference API/Demo Web container 정의에 실제 Docker runtime 검증까지 들어갔다. Docker 검증 코드 기준 commit은 `1a1c8fb23b30c058eb134ed3b92c3b94d14b09f0`다.

GitHub Actions run `34378180449`에서 Ubuntu와 Windows matrix, 별도 Ubuntu Docker job이 모두 통과했다. Docker job은 Docker Engine `28.0.4`, Docker Compose `v2.38.2`에서 두 image를 build한 뒤 Compose service를 실제로 띄워 health, API, Web, container 대상 Playwright, cleanup까지 확인했다. `v0.1.0` tag와 GitHub Release, npm publish는 별도 승인 전까지 만들거나 실행하지 않는다. 브랜치와 default branch의 현재 상태는 GitHub 설정을 기준으로 확인한다.

## 공개 Version Contract

- 공개 package와 Engine: `0.1.0`
- Canonical Schema: `3.0.0`
- Installation Context: `2.0.0`
- Field Evidence: `3.0.0`
- Result Snapshot: `2.0.0`
- Standard RuleSet: `0.1.0`
- Identity Mapper: `1.1.0`
- BuildCores Adapter: `3.0.0`
- Reference Policy: `1.0.0`

각 숫자는 독립된 domain이다. `corepack pnpm version:check`가 package manifest, runtime constant, public export, Reference Snapshot metadata를 함께 비교한다.

## Task 22 — 문서와 실제 산출물

- README에 프로젝트 범위, 비범위, Status/Decision, UNKNOWN/NOT_CHECKED, Rule 영역, BuildCores, Exact/Similar Evidence, Power Budget, Optional LLM, SDK/API/Docker/Demo 사용법, 라이선스, 한계와 Roadmap을 정리했다.
- 공개 문서 세트와 maintainer 문서를 `docs/`에 추가했다. 문장은 현재 구현 범위만 설명하며 정확도나 지원 범위를 과장하지 않았다.
- `docs/diagrams/*.mmd` 두 파일이 Mermaid source of truth다. 생성한 `docs/assets/package-dependencies.svg`, `runtime-data-flow.svg`를 함께 추적한다.
- 실제 production Demo를 Playwright로 열어 `docs/assets/demo-overview.png`를 만들었다. 화면에는 합성 조립 시나리오라는 점이 드러난다.
- `docs/openapi.json`은 Reference API runtime의 `/openapi.json` 응답으로 생성한다. 현재 business operation은 15개다.
- `docs:check-links`가 내부 Markdown link, 필수 문서·asset, OpenAPI endpoint 목록, 실제 workspace dependency와 Diagram edge를 검사한다.

BuildCores 문서에서는 pinned/reference validation commit `a3795382f9e73c283e3592a8c972842fd0e72e22`, schema fingerprint, Task 17 조사 data commit `547b32703b370142f17b09c3047c80dc88ba5260`, 2026-09-09 확인 시점 upstream HEAD `932a6cfcb4fbe372bcd0ed600a7e127295d25dee`를 서로 다른 역할로 적었다. BuildCores 데이터는 ODC-By 1.0이며 PCPartCheck의 Apache-2.0 코드 라이선스에 포함되지 않는다.

## Task 23 — Version과 release 준비

- Changesets `3.0.2`를 설정했다. 초기 `0.1.0` 기준선이라 version을 올리는 Changeset은 만들지 않았다.
- 14개 공개 package version은 모두 `0.1.0`이다.
- `pack:check`는 각 package의 실제 `pnpm pack --dry-run --json`을 확인한다.
- release workflow는 version/pack/Changesets 상태와 release metadata까지만 다룬다. npm publish, `NPM_TOKEN`, tag, GitHub Release 생성 step은 없다.
- GitHub Actions는 `actions/checkout` v7.0.1, `pnpm/setup` v2, `actions/upload-artifact` v4를 확인한 commit SHA로 고정했다. CI의 install은 별도 `pnpm install --frozen-lockfile` step이다.

## Task 24 — Container와 운영 경계

- `apps/reference-api/Dockerfile`, `apps/demo-web/Dockerfile`, root Compose 두 파일과 `.dockerignore`를 추가했다.
- 두 image는 Node `24.13.1-bookworm-slim` multi-stage build이며 final stage는 `node` 사용자로 실행한다.
- API final stage는 `pnpm deploy --prod` bundle, Web final stage는 Docker build에서만 만든 Next standalone output을 사용한다.
- Compose는 API 3001, Web 3000을 loopback에 공개하고 service health와 API dependency를 설정한다.
- 현재 Compose는 synthetic mode다. SQLite package를 연결하지 않으며 volume도 없다.
- Docker build stage에는 Node 24에서 `better-sqlite3`을 source build할 때 필요한 `python3`, `make`, `g++`만 넣었다. runtime stage에는 build toolchain이 들어가지 않는다.
- Demo Web Docker build는 `@pcpartcheck/demo-web...` dependency closure를 먼저 build해 standalone output에 workspace package가 빠지지 않게 했다.

Passed — Docker 계약 unit test 5건, Next 일반 production build, Docker 환경 변수로 생성한 standalone server 경로 확인.

Passed — production deploy로 만든 Reference API portable bundle의 `/health`와 `/openapi.json` 로컬 확인.

Passed — GitHub Actions run `34378180449`의 실제 `docker compose config`, 두 image build, `up -d`, `reference-api`/`demo-web` healthy, `/health`, `/openapi.json`, Web HTTP, desktop/mobile Playwright, `down --volumes --remove-orphans`.

첫 Docker run `34376342605`는 slim builder에 Python이 없어 `better-sqlite3`의 `node-gyp` build가 실패했다. 두 번째 run `34377278292`는 Demo build가 workspace dependency closure를 빼먹어 `@pcpartcheck/api-contracts`를 찾지 못했다. 두 문제 모두 Dockerfile과 패키징 범위에서만 고쳤으며 Domain, Rule, Provider, API, Canonical Schema는 바꾸지 않았다.

## 검증 결과

- Passed — `corepack pnpm install --frozen-lockfile`
- Passed — `corepack pnpm check:deps`
- Passed — `corepack pnpm typecheck`
- Passed — `corepack pnpm lint`
- Passed — `corepack pnpm test:unit`, 25개 파일 216건
- Passed — `corepack pnpm test:integration`, 4개 파일 34건
- Passed — `corepack pnpm build`
- Passed — `corepack pnpm test:e2e`, desktop/mobile Chromium 2건
- Passed — `docs:openapi`, `docs:diagram`, `docs:screenshot`, `docs:check-links`; 재생성 후 tracked artifact diff 없음
- Passed — `version:check`
- Passed — `pack:check`, 공개 package 14개
- Passed — README의 Reference API start, `/health`, `/openapi.json` 명령 흐름
- Passed — GitHub Actions run `34378180449`: Docker 2분 8초, Ubuntu 2분 26초, Windows 3분 8초
- Passed — 추적 파일명과 본문의 secret/credential/private key, 개인 로컬 경로, DB/build output, 회사 내부 데이터 marker 검사

## 남은 제약과 다음 단계

BuildCores에는 Storage 장치 M.2 Key, M.2/SATA 공유 조건, PCIe physical/electrical 구분, 추가 EPS 필수 여부, Fan 두께가 없다. 제조사 CPU support/BIOS/QVL Provider, 운영 인증·rate limit·Attachment Storage, 실제 persistence composition도 아직 없다. Similarity weight는 합성 fixture로 결정론만 확인했다.

실제 Docker runtime release gate까지 통과했다. 이후 릴리스 단계에서도 `feat/checkpoint-1-foundation` 브랜치는 사용자 확인 전 삭제하지 않는다. `v0.1.0` tag, GitHub Release, npm publish는 아직 승인되지 않았으므로 실행하지 않는다.
