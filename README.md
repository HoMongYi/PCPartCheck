# PCPartCheck

PCPartCheck는 PC 부품 정보를 한 가지 형식으로 정리하고, 조합별 호환성을 규칙으로 판정하는 오픈 소스 TypeScript 프로젝트입니다. 쇼핑몰이나 특정 데이터 공급자에 묶이지 않는 엔진을 목표로 개발하고 있습니다.

현재는 기반 계약을 구현하는 단계입니다. 아직 실제 부품 조합을 검사하거나 HTTP API와 데모 화면을 실행할 수 없습니다. 사용할 수 있는 기능과 실행 방법은 각 Checkpoint가 끝날 때마다 이 문서에 반영합니다.

## 개발 환경

- Node.js 24
- pnpm 12

```bash
corepack pnpm install
corepack pnpm check:deps
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:unit
```

## 라이선스

코드는 [Apache License 2.0](LICENSE)으로 배포합니다. 외부 데이터의 라이선스와 출처 표기는 해당 Provider 문서에서 따로 관리할 예정입니다.
