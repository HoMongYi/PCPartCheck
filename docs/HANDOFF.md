# Maintainer Handoff

이 문서는 공개 저장소에서 다음 maintainer가 작업 경계를 빠르게 확인하도록 돕는 안내입니다. 진행 중인 로컬 작업 상태는 저장소 루트의 [`HANDOFF.md`](../HANDOFF.md)를 기준으로 합니다.

## 먼저 확인할 계약

1. [Architecture](ARCHITECTURE.md)와 package dependency 검사
2. [Rule Engine](RULE-ENGINE.md)의 Status/Decision/Coverage
3. [Evidence Model](EVIDENCE-MODEL.md)과 [Field Evidence](FIELD-EVIDENCE.md)
4. [Versioning](VERSIONING.md)과 Result Snapshot replay
5. [BuildCores Provider](providers/buildcores.md)의 pin/fingerprint/Attribution

## 변경 전 질문

Rule이 raw Provider field를 읽어야 하는가, 데이터 부족을 `PASS`로 만들어야 하는가, ADVISORY만으로 `BLOCK`해야 하는가, Similar Evidence를 incompatibility 근거로 써야 하는가, LLM이 deterministic validation을 바꿔야 하는가를 확인합니다. 하나라도 그렇다면 기존 계약과 충돌하므로 구현을 멈추고 설계를 먼저 검토합니다.

## 기본 검증

```bash
corepack pnpm check:deps
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm docs:check-links
corepack pnpm version:check
corepack pnpm pack:check
```

실제 실행한 결과만 Passed, Failed, Not run, Needs verification 중 하나로 기록합니다. 외부 CI, Docker, 배포 상태를 로컬 결과로 추정하지 않습니다.
