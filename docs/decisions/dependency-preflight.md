# Dependency preflight — 2026-09-08

Node.js 24.13.1과 Windows/Linux CI를 기준으로 npm 및 GitHub의 공개 메타데이터를 다시 확인했다. 버전은 범위가 아니라 정확한 값으로 고정한다.

| 항목 | 확인한 최신 버전 | 채택 방침 |
| --- | ---: | --- |
| pnpm | 12.3.4 | 12.3.4 |
| TypeScript | 7.0.2 | 6.0.3 |
| Vitest | 5.0.0 | 5.0.0 |
| ESLint | 10.10.0 | 10.10.0 |
| `@eslint/js` | 10.0.1 | 10.0.1 |
| typescript-eslint | 8.69.0 | 8.69.0 |
| Fastify | 5.12.3 | Checkpoint 3에서 재확인 |
| `@fastify/swagger` | 9.8.1 | Checkpoint 3에서 재확인 |
| `@fastify/swagger-ui` | 6.1.1 | Checkpoint 3에서 재확인 |
| TypeBox | 0.34.52 | 0.34.52 |
| Ajv | 8.20.0 | 필요 시 Checkpoint 3에서 재확인 |
| Drizzle ORM | 0.45.2 | Checkpoint 3에서 재확인 |
| drizzle-kit | 0.31.10 | Checkpoint 3에서 재확인 |
| better-sqlite3 | 13.0.3 | Checkpoint 3에서 재확인 |
| Next.js | 16.3.4 | Checkpoint 3에서 재확인 |
| React | 19.2.8 | Checkpoint 3에서 재확인 |
| Playwright | 1.63.0 | Checkpoint 3에서 재확인 |
| Changesets CLI | 3.0.2 | Checkpoint 4에서 재확인 |

TypeScript 7.0.2는 typescript-eslint 8.69.0의 peer 범위인 `<6.1.0`을 벗어나므로 사용하지 않는다. TypeScript 6.0.3은 해당 범위와 Node.js 24 조건을 모두 만족한다.

CI Action의 공식 최신 안정 릴리스는 `actions/checkout@v7.0.1`, `actions/setup-node@v7.0.0`, `pnpm/setup@v2.1.0`, `changesets/action@v2.1.2`였다. CI 파일은 유지보수되는 major tag를 사용한다. pnpm 12에서는 Node 설치와 lockfile 검증을 함께 지원하는 `pnpm/setup@v2`를 선택했다.

BuildCores OpenDB의 기준 commit은 `ce2e22b85a3b9a5ee10c28fd8a457b9b536eeff1`이며 commit 시각은 2026-09-06T12:24:21Z다. 실제 importer 구현 전에는 Schema와 라이선스를 다시 확인한다.

Checkpoint 3을 시작하기 직전 npm registry를 다시 조회했으며 위 버전은 그대로 유지됐다. `better-sqlite3` 13.0.3의 Node.js 요구 범위는 `>=22`이고 Drizzle ORM 0.45.2의 driver peer 범위는 `better-sqlite3 >=7`이라 Node.js 24 환경과 맞는다. pnpm의 install-script 정책에는 고정 버전으로 설치한 `better-sqlite3`와 esbuild만 허용했다.
