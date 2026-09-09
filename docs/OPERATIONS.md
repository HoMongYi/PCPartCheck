# Operations

현재 제공하는 Reference API와 Demo Web은 계약 확인용 synthetic mode입니다. 운영 데이터베이스, 실제 인증, 외부 Attachment Storage를 붙인 배포 구성이 아닙니다.

## 로컬 실행

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm --filter @pcpartcheck/reference-api start
```

Reference API는 기본 `PORT=3001`로 모든 interface에 listen합니다. Demo Web은 `PCPARTCHECK_API_URL`에 서버 측 `/v1/demo` 주소를, `PCPARTCHECK_PUBLIC_API_URL`에 브라우저에서 열 API 문서 주소를 받습니다.

## Docker Compose

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose down
```

Compose는 API 3001, Web 3000을 공개합니다. 두 image는 Node 24 기반 multi-stage build이고 최종 stage는 non-root user로 실행합니다. Health check는 API의 `/health`, Web의 `/`를 확인합니다.

`docker-compose.test.yml`은 host Playwright가 Compose의 Web을 검사할 때 사용합니다. `PCPARTCHECK_E2E_BASE_URL=http://127.0.0.1:3000`을 지정하면 Playwright가 자체 webServer를 띄우지 않고 이미 실행 중인 container를 사용합니다.

```powershell
docker compose -f docker-compose.test.yml up -d --build
$env:PCPARTCHECK_E2E_BASE_URL='http://127.0.0.1:3000'
$env:PCPARTCHECK_E2E_API_URL='http://127.0.0.1:3001'
corepack pnpm exec playwright test
docker compose -f docker-compose.test.yml down
```

Reference API image는 `pnpm deploy --prod`로 만든 portable bundle만 최종 stage에 복사합니다. Demo image는 Next standalone output과 정적 asset만 복사합니다. 두 runtime stage 모두 `node` 사용자로 실행하며 개발 의존성, 이 저장소의 test fixture, build cache와 `.env`는 image context에서 제외합니다.

## Synthetic mode와 persistence

Reference API는 실행할 때 합성 catalog와 memory Evidence/Attachment를 구성합니다. container를 내리면 수정 내용은 사라집니다. `@pcpartcheck/storage-sqlite` package와 migration은 구현돼 있지만 이 Compose에는 연결하지 않았으므로 volume도 선언하지 않습니다.

실제 persistence composition을 만들 때는 DB 경로와 volume, migration 시점, backup/restore, 동시성, Evidence attachment lifecycle을 먼저 정해야 합니다. 단순히 현재 Demo에 SQLite 파일을 mount하는 방식은 운영 지원으로 간주하지 않습니다.

## 관찰과 장애 확인

`GET /health`는 process와 Canonical Schema version을 확인하는 최소 probe입니다. upstream Provider 상태나 DB 상태를 종합하는 운영 health는 아직 없습니다. OpenAPI는 `GET /openapi.json`, Swagger UI는 `GET /docs/`에서 확인합니다. 로그에 Authorization header, token, Evidence 원문, local path를 남기지 마세요.
