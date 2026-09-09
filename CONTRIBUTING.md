# 기여 안내

PCPartCheck는 판정 결과를 재현할 수 있어야 합니다. 코드를 고치기 전에 변경이 어느 계약에 속하는지부터 확인해 주세요. Package, Canonical Schema, Installation Context, Field Evidence, Snapshot, RuleSet, Identity Mapper, Provider Adapter 버전은 서로 독립적입니다.

## 개발 환경

Node.js 24와 pnpm 12가 필요합니다. Corepack을 활성화한 뒤 아래 명령으로 시작합니다.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check:deps
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm build
```

UI를 바꿨다면 `corepack pnpm test:e2e`도 실행합니다. 문서를 바꿨다면 생성 산출물을 갱신한 뒤 `corepack pnpm docs:check-links`로 내부 링크, OpenAPI endpoint, dependency diagram을 확인합니다.

## 작업 방식

새 개발은 `main`에서 직접 하지 않고 feature branch에서 진행한 뒤 Pull Request로 합칩니다. 테스트가 실패하는 상태를 먼저 확인하고, 필요한 최소 구현으로 통과시킨 다음 관련 전체 검증을 실행해 주세요. 서로 관련 없는 정리 작업은 같은 변경에 넣지 않습니다.

Rule과 Provider는 각각 [Rule 추가 절차](docs/ADDING-A-RULE.md), [Provider 추가 절차](docs/ADDING-A-PROVIDER.md)를 따릅니다. 데이터가 없을 때 `PASS`로 바꾸거나, Rule에서 raw Provider field를 읽게 만드는 변경은 받지 않습니다.

## Changeset

공개 패키지에 영향을 주는 변경에는 Changeset을 추가합니다.

```bash
corepack pnpm changeset
```

변경한 패키지와 patch/minor 수준, 사용자가 알아야 할 내용을 적습니다. Schema나 RuleSet 버전이 달라졌다면 package Changeset과 별도로 [Versioning 계약](docs/VERSIONING.md)에 맞는 runtime constant와 Snapshot 검증도 고쳐야 합니다.

## Pull Request 확인 항목

- 새 동작을 재현하는 테스트가 있는가
- `@pcpartcheck/core`가 다른 내부 패키지에 의존하지 않는가
- Rule이 Canonical field만 읽는가
- `UNKNOWN`과 `NOT_CHECKED`, Status와 Decision을 섞지 않았는가
- 문서, OpenAPI, 생성 Diagram이 코드와 같은가
- 외부 데이터의 라이선스와 Attribution을 지켰는가
- `.env`, token, 고객·회사 데이터, 로컬 절대경로가 포함되지 않았는가

Contributor License Agreement는 현재 요구하지 않습니다. 기여한 코드는 저장소의 Apache-2.0 라이선스로 배포됩니다.
