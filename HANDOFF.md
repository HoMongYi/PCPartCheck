# PCPartCheck 작업 인계

## 현재 상태

`feat/checkpoint-1-foundation` 브랜치에서 Checkpoint 3.6 — Final Domain Integrity Hardening을 마쳤다. 구현 HEAD는 `90e22f3`이며 원격 feature branch에 push했다. merge하지 않았고 Checkpoint 4도 시작하지 않았다.

공개 Schema 버전은 Canonical `3.0.0`, Installation Context `2.0.0`, Field Evidence `3.0.0`, Result Snapshot `2.0.0`이다. 엔진과 패키지 버전은 계속 `0.1.0`이다. Snapshot에는 Installation Context 버전도 따로 남으며, Canonical 또는 Installation Context 버전이 다르면 Replay를 거부한다.

## 고정한 Domain Contract

- M.2 장치 Key는 `B / M / B_M`, 슬롯 Key는 `B / M / B_M / E`로 구분한다. B+M 장치는 B 또는 M 슬롯에 장착할 수 있지만, E 슬롯은 일반 SSD 호환 슬롯으로 보지 않는다. 장치 Key를 모르면 `UNKNOWN`이다.
- M.2 슬롯의 `sharedSataPortIds`가 없으면 공유 정보를 모르는 상태다. `[]`일 때만 공유 포트가 없다고 확인된 것으로 본다.
- Installation Context의 배치·케이블·두께 필드는 생략할 수 있다. `undefined`는 미확인, `0 / false / []`는 확인된 값이다. 필요한 정보가 없으면 Rule은 `PASS` 대신 `UNKNOWN`을 반환한다.
- PSU 공급 커넥터와 부품 전원 요구도 같은 원칙을 쓴다. 필드 생략은 미확인이고 빈 배열은 없음이 확인된 상태다.
- Case Fan은 지름과 커넥터를 확인할 수 있으면 Canonical Part로 만든다. 두께가 없다는 이유로 전체 레코드를 버리지 않으며, 두께가 필요한 판정만 `UNKNOWN`으로 남긴다.
- Similar Failure는 참고 Evidence일 뿐 Compatibility Status나 Decision을 바꾸지 않는다.

## Field Evidence 3.0

Field Evidence는 `DRAFT`일 때만 WRITE 권한으로 수정할 수 있다. `DRAFT → APPROVED`, `DRAFT → REJECTED`는 별도의 `FIELD_EVIDENCE_MODERATE` 권한으로만 처리한다. APPROVED와 REJECTED 기록은 수정, 재승인, 직접 승격할 수 없으며 HTTP API는 충돌을 409로 반환한다. 수정본이 필요하면 새 DRAFT를 만들고 `supersedesEvidenceId`로 이전 기록을 연결한다.

모든 기록에는 `createdByPrincipalId`, `createdAt`, `updatedAt`이 들어간다. 승인·반려가 끝난 기록에는 moderator의 opaque principal ID와 처리 시각도 남는다. Outcome은 `ASSEMBLY_SUCCESS / ASSEMBLY_FAILURE / CONDITIONAL_SUCCESS`이고, 조건부 성공에는 조건이 적어도 한 개 필요하다.

첨부는 `AttachmentReference`와 `AttachmentStorageProvider`로 분리했다. Evidence에는 media type, checksum, 크기, opaque storage key만 저장한다. 공개 Reference API는 합성 PNG 한 장을 메모리 저장소에서 제공하며, 첨부 조회도 Evidence visibility와 같은 권한 경계를 거친다.

## Provider와 LLM 확장점

BuildCores Adapter는 CPU, Motherboard, RAM, GPU, PCCase, PSU, Storage를 지원하고 CPUCooler는 안전하게 유형을 확정할 수 있을 때만 가져온다. CaseFan은 부분 Canonical Part로 가져온다. RAM `speed`는 BuildCores 내부의 `SOURCE_SEMANTIC_ALIAS`로만 `dataRateMtps`에 옮기며 Unit Normalizer에는 MHz→MT/s 규칙이 없다.

Provider SDK에는 `ManufacturerSpecificationProvider`, `CpuSupportProvider`, `BiosReleaseProvider`, `MemoryQvlProvider` 계약과 runtime schema가 있다. 실제 Provider나 Scraper는 구현하지 않았다. Reference API에서 네 capability는 `providerAvailable: false`, `defaultMode: DISABLED`다.

선택형 LLM 계약에는 Structured Intent Parser와 Evidence Note Summarizer가 추가됐다. Parser는 제공된 Canonical Part ID만 사용할 수 있다. Summarizer는 원문을 보존하며 status, decision, verdict, outcome을 만들 수 없다. 기존 Result Explainer와 Identity Mapping Assistant도 결정론적 결과를 바꿀 수 없다.

## 공개 API

- `GET /health`
- `POST /v1/compatibility/check`
- `POST /v1/compatibility/check-batch`
- `GET /v1/parts` — `limit` 기본 50, 최대 100, `offset` 지원
- `GET /v1/parts/:id`
- `GET /v1/evidence/:id`
- `POST /v1/field-evidence/similar`
- `GET /v1/capabilities`
- `GET /v1/profiles`
- `POST /v1/field-evidence`
- `PATCH /v1/field-evidence/:id`
- `POST /v1/field-evidence/:id/approve`
- `POST /v1/field-evidence/:id/reject`
- `GET /v1/field-evidence/:id/attachments/:attachmentId`
- `GET /v1/demo`
- `GET /openapi.json`
- `GET /docs/`

`reference-default`는 소켓, 메모리 세대·용량, 폼팩터, 공간, 냉각, Storage, PCIe 물리 슬롯, Power Budget, PSU 커넥터를 REQUIRED로 둔다. PCIe 대역폭, Fan/RGB Header, Memory Rate, 4-DIMM Rate는 ADVISORY다. 아직 Provider가 없는 제조사 사양·CPU 지원·BIOS·QVL은 DISABLED다.

## 이번 Checkpoint 커밋

- `47b6a12 fix(domain): preserve unknown hardware facts`
- `2ba3c0a feat(evidence): enforce immutable moderation records`
- `9ac2223 feat(provider-sdk): define manufacturer support contracts`
- `0427d50 feat(llm): add optional structured input tools`
- `9b98f38 feat(api): bound catalog and evidence searches`
- `90e22f3 test(domain): tighten release boundary coverage`

## 검증 상태

- Passed — `corepack pnpm check:deps`
- Passed — `corepack pnpm typecheck`
- Passed — `corepack pnpm lint`
- Passed — `corepack pnpm test:unit`, 21개 파일 197건
- Passed — `corepack pnpm test:integration`, 4개 파일 33건
- Passed — `corepack pnpm build`, 전체 패키지와 앱 production build
- Passed — `corepack pnpm test:e2e`, desktop/mobile Chromium 2건
- Passed — GitHub Actions run `34288087896`, Ubuntu 1분 7초·Windows 2분 37초
- Passed — 변경 파일의 민감 파일명, private key, 로컬 절대경로, credential 형태 문자열 검사

## 남은 데이터 한계

- BuildCores에는 Storage 장치 Key, M.2/SATA 공유 조건, 메인보드 PCIe physical/electrical 구분, 추가 EPS의 필수 여부, Fan 두께가 없다. Adapter는 이를 추정하지 않으며 관련 판정은 `UNKNOWN`이 될 수 있다.
- BIOS/QVL Provider, 실제 계정·권한 시스템, 분산 Attachment Storage는 계약만 있고 구현은 없다.
- Similarity 가중치는 합성 fixture로 결정론만 확인했다. 실제 Evidence가 쌓이면 issue별 보정이 필요하다.
- 공개 배포, Docker, README·Architecture Diagram·실제 Demo Screenshot·Changesets/SemVer 정리는 Checkpoint 4 범위다.

## 다음 작업

사용자 검토 전에는 Checkpoint 4를 시작하지 않는다. 승인받으면 Task 22~24의 공개 문서와 릴리스 품질 작업만 진행한다.
