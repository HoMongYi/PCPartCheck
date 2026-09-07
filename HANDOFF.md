# PCPartCheck 작업 인계

## 현재 상태

Checkpoint 1의 Task 1~7을 `feat/checkpoint-1-foundation` 브랜치에 구현했다. Checkpoint 2는 시작하지 않았으며 사용자 검토를 기다리고 있다. 원격 저장소에는 아직 push하지 않았다.

## 완료한 범위

- pnpm monorepo, Node.js 24 기준 CI, 내부 dependency graph 검사
- versioned Canonical Spec Schema와 구조화된 전원·헤더·M.2·라디에이터·PCIe subtype
- raw field Evidence 보존과 물리 단위 normalization
- 단일 `CapabilityPolicy.mode`, Capability registry, Rule contract
- Compatibility Status와 Decision 분리, Required/Advisory Coverage 집계
- Build Intent와 versioned typed InstallationContext
- deterministic Rule 실행, Result Snapshot, version 검증 replay

`InstalledRadiator.sizeMm`은 양의 정수이며 규격 목록으로 제한하지 않는다. 일반 UnitNormalizer에는 `MHz → MT/s` 변환이나 `SOURCE_SEMANTIC_ALIAS`가 없다. BuildCores의 `RAM.speed` 해석은 Task 17 Adapter에서만 구현해야 한다.

## Commit 경계

1. `chore: bootstrap monorepo and CI`
2. `feat(core): define canonical spec schema`
3. `feat(evidence): add raw evidence and unit normalization`
4. `feat(core): add capability policy and rule contracts`
5. `feat(core): aggregate compatibility results`
6. `feat(core): add build intent and installation context`
7. `feat(core): add compatibility engine and snapshots`

## 검증 결과

- Passed — `corepack pnpm check:deps`
- Passed — `corepack pnpm typecheck`
- Passed — `corepack pnpm lint`
- Passed — `corepack pnpm test:unit` (7 files, 33 tests)
- Passed — `corepack pnpm build` (core, evidence)
- Passed — `corepack pnpm test:integration` (Checkpoint 1에는 integration test가 없어 0건으로 정상 종료)
- Needs verification — GitHub Actions의 Ubuntu/Windows matrix 실행. 원격 push 전이라 아직 실행되지 않았다.

## 계획과 달라진 점

- TypeScript 최신 7.0.2는 typescript-eslint 8.69.0의 peer 범위를 벗어나 6.0.3으로 고정했다.
- pnpm 12와 Node.js 24를 함께 설치하고 lockfile을 검사하는 `pnpm/setup@v2`를 CI에 사용했다.
- 로컬 Windows PATH에 남아 있던 standalone pnpm 10이 재귀 스크립트에서 선택되지 않도록 루트 명령은 `corepack pnpm`을 명시한다.
- `@eslint/js`는 ESLint와 버전 번호가 같지 않으며, 실제 최신 배포 버전인 10.0.1을 사용한다.

## 남은 위험

- BuildCores Schema와 importer는 Task 17에서 다시 확인해야 한다. 현재 기준 commit은 `ce2e22b85a3b9a5ee10c28fd8a457b9b536eeff1`이다.
- 실제 Standard Rule이 아직 없으므로 Canonical field의 충분성은 Checkpoint 2 첫 Rule을 TDD로 구현하면서 다시 확인해야 한다. 승인된 Public Contract를 깨야 하거나 raw provider field가 필요해지면 즉시 중단한다.
- CI workflow는 로컬 정적 검증만 마쳤다. 실제 Windows/Ubuntu runner 결과는 첫 push 뒤 확인해야 한다.

## 다음 작업

사용자 승인 후 Checkpoint 2의 Task 8부터 시작한다. Task 8 이전에는 Checkpoint 1 Contract를 임의로 바꾸지 않는다.
