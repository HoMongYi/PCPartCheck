# Reference HTTP API

Reference API는 Fastify와 shared `@pcpartcheck/api-contracts` DTO로 구성합니다. 현재 구현은 합성 catalog와 memory Evidence storage를 사용하며 운영 인증 시스템이나 영구 저장소를 제공하지 않습니다.

Runtime이 내보낸 전체 계약은 [`docs/openapi.json`](openapi.json)에 있습니다. 이 파일은 `corepack pnpm docs:openapi`가 실제 서버의 `/openapi.json` 응답으로 생성합니다. 직접 수정하지 않습니다. `docs:check-links`는 아래 목록을 generated OpenAPI와 비교합니다.

## Endpoint

- `GET /health` — service와 Canonical Schema version 확인
- `POST /v1/compatibility/check` — 한 구성을 검사하고 Result Snapshot 반환
- `POST /v1/compatibility/check-batch` — bounded batch 검사
- `GET /v1/parts` — category, manufacturer, search, limit, offset으로 Canonical Part 조회
- `GET /v1/parts/{id}` — Canonical Part 한 건 조회
- `GET /v1/evidence/{id}` — visibility 권한을 적용한 Field Evidence 조회
- `POST /v1/field-evidence/similar` — 허용된 범위에서 Similar Evidence 최대 3건 조회
- `GET /v1/capabilities` — 제공 가능한 Capability와 기본 mode 조회
- `GET /v1/profiles` — Reference Policy Profile 조회
- `POST /v1/field-evidence` — 권한 있는 사용자가 DRAFT 생성
- `PATCH /v1/field-evidence/{id}` — DRAFT만 수정
- `POST /v1/field-evidence/{id}/approve` — 별도 moderation 권한으로 승인
- `POST /v1/field-evidence/{id}/reject` — 별도 moderation 권한으로 반려
- `GET /v1/field-evidence/{id}/attachments/{attachmentId}` — visibility 확인 뒤 attachment 조회
- `GET /v1/demo` — 합성 Demo dashboard 데이터

Swagger UI는 `GET /docs/`, OpenAPI JSON은 `GET /openapi.json`에서 제공합니다. 두 경로는 문서 endpoint 비교에서 제외되는 문서 자체의 transport endpoint입니다.

## 호환성 요청

`POST /v1/compatibility/check` body에는 `build`, `intent`, `installationContext`, `policyProfile`, `evidenceSnapshot`이 필요합니다. 각 Schema version은 현재 runtime constant와 같아야 합니다. 응답은 Version Contract, input/evidence snapshot, 집계 결과를 포함한 `ResultSnapshot`입니다.

잘못된 Canonical 또는 Installation Context는 Rule을 실행하기 전에 400으로 거부합니다. 지원하지 않는 과거 Schema를 조용히 현재 의미로 읽지 않습니다.

## 인증 경계

Reference memory authorization은 테스트용입니다. 실제 서비스에서는 `AuthorizationProvider`를 주입해야 합니다. request body나 query가 read scope를 지정하지 않으며, 서버가 credential의 권한으로 `PUBLIC`, `STAFF`, `ADMIN` 범위를 정합니다.

무인증 Similar search는 PUBLIC만, STAFF read 권한은 PUBLIC과 STAFF_ONLY, ADMIN read 권한은 세 visibility를 모두 볼 수 있습니다. Similar 응답에는 `evidenceId`, `issueType`, `similarityScore`, `matchedFields`, `differences`, `reason`이 있으며 Status나 Decision은 없습니다.

## 오류 처리

입력 검증 실패는 400, 인증 없음은 401, 권한 부족은 403, 없는 resource는 404, immutable Evidence 상태 충돌은 409, rate limit 초과는 429입니다. 실제 응답 Schema와 세부 body는 generated OpenAPI를 기준으로 합니다.
