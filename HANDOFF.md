# PCPartCheck 작업 인계

## 현재 상태

`feat/checkpoint-1-foundation` 브랜치에서 Checkpoint 1 정리와 Checkpoint 2의 Task 8~15를 마쳤다. Checkpoint 3은 시작하지 않았으며 사용자 검토를 기다리고 있다. 원격 저장소에는 아직 push하지 않았다.

Checkpoint 1의 단위 변환 코드는 `packages/unit-normalization`으로 분리했다. 이 패키지와 `packages/evidence`는 서로 의존하지 않고 각각 `core`만 사용한다. `core`에는 다른 `@pcpartcheck/*` 패키지 import가 없다. Integration test는 아직 만들지 않았으므로 실행 결과를 통과로 세지 않는다.

## 이번에 구현한 범위

- CPU 소켓, 메모리 세대·용량, 메인보드 폼팩터 판정
- GPU·CPU 쿨러·PSU·라디에이터 간섭과 안전 여유 판정
- M.2 슬롯 배치, SATA 포트 공유, PCIe 슬롯 자원 판정
- 정책 기본값의 출처를 남기는 Power Budget과 PSU 용량·커넥터 판정
- 팬 헤더 수·개별 허용 전류, RGB 전압·핀 배열, 메모리 전송률 Advisory
- 기존 External Mapping을 먼저 재사용하는 Canonical Identity 매퍼
- 승인된 Exact Field Evidence의 실패·조건부 실패·성공 처리
- 이슈별 가중치로 상위 3건만 반환하는 deterministic Similarity

정보가 없을 때는 `UNKNOWN`을 유지한다. Advisory Rule의 `INCOMPATIBLE`은 전체 Decision을 `BLOCK`으로 올리지 않는다. Similar Evidence는 점수와 비교 근거만 반환하며 Compatibility Status나 Decision을 만들지 않는다.

## Commit 경계

- `8926b8d refactor: isolate unit normalization package`
- `0a7a9a8 feat(rules): add platform compatibility rules`
- `65f69ce feat(rules): add clearance and cooling rules`
- `62737fa feat(rules): add storage compatibility rules`
- `d829405 feat(power): add deterministic power evaluation`
- `9f05ce4 feat(rules): add header and memory advisory rules`
- `49f8f4f feat(identity): add deterministic identity mapping`
- `21ac8b0 feat(evidence): apply exact field evidence`
- `de44594 feat(similarity): rank similar field evidence`
- `e9077b3 fix(compatibility): tighten deterministic validation`

마지막 수정 커밋은 Task 경계 검토에서 발견한 두 가지 누락을 보완한다. 단일 팬의 전류를 여러 헤더 용량으로 합산하지 않도록 바꿨고, 식별자가 같더라도 핵심 사양이 충돌하면 Identity 자동 병합을 거부한다. `ExternalMapping` 감사 필드도 이 커밋에서 완성했다.

## 검증 결과

- Passed — `corepack pnpm check:deps`
- Passed — `corepack pnpm typecheck`
- Passed — `corepack pnpm lint`
- Passed — Task 8~15 경계 테스트 8개 파일, 74건
- Passed — `corepack pnpm test:unit` 15개 파일, 115건
- Passed — `corepack pnpm build` 7개 패키지
- N/A — `corepack pnpm test:integration`은 종료 코드 0이지만, integration tests begin in later tasks
- Needs verification — GitHub Actions Ubuntu/Windows matrix. 아직 원격에 push하지 않아 실행되지 않았다.

Power Budget 기준 시나리오는 `estimatedPeakPowerW=500`, `minimumPsuW=600`, `calculatedRecommendedPsuW=650`, `recommendedPsuW=650`으로 계산됐다. PSU 550W는 `INCOMPATIBLE`, 600W는 `WARNING`, 650W는 `PASS`였다. 제조사 권장값이 750W면 최종 권장값도 750W를 선택했다.

Exact Field Evidence에서는 승인된 실제 실패가 `INCOMPATIBLE`, 해결 조건이 있는 실패가 `CONDITIONAL`로 처리됐다. 성공 한 건은 기존 Hard Rule 실패를 뒤집지 않았다. 설치 맥락이 다르면 Similar로 분류됐고, Similar 실패 사례에는 Status와 Decision이 생기지 않았다.

Identity 테스트에서는 기존 외부 매핑, MPN·GTIN, 정규화된 제조사·모델과 핵심 사양 일치를 확인했다. 핵심 사양 충돌은 `REJECTED`, 유사 이름만 있는 후보는 `REVIEW_REQUIRED`였다. 새 부품에 만든 UUID는 재Import 때 기존 매핑을 통해 그대로 재사용됐다.

## 계획과 달라진 점

- Task 9에서 `PsuSpec.lengthMm`을 optional field로 추가했다. 기존 필드를 바꾸거나 제거하지 않은 additive 변경이며 `CANONICAL_SCHEMA_VERSION`은 `1.0.0`을 유지한다.
- `similarity`는 현재 필요한 `core`와 `evidence`만 import한다. 승인된 그래프가 허용하는 `identity` 의존성은 실제 사용처가 없어 넣지 않았다.
- Task 12와 13의 경계 검토 결과를 Task별 커밋 뒤의 수정 커밋 `e9077b3`에 따로 남겼다. 기능 범위는 늘리지 않았다.

## 확인된 데이터 한계와 위험

- 메모리 고속·4-DIMM 판단은 메인보드 지원 전송률과 Policy threshold까지만 본다. QVL, BIOS 버전, CPU 메모리 컨트롤러 편차는 데이터가 생기기 전까지 추측하지 않는다.
- M.2와 SATA 공유 정보는 포트 관계만 표현한다. 보드별 세부 활성화 조건이 없으면 안전하게 `CONDITIONAL`을 반환한다.
- 팬·RGB 판정은 메인보드 직결 기준이다. 제품에 포함된 컨트롤러나 데이지체인 정보가 Canonical Spec에 없으면 자동으로 있다고 보지 않는다.
- Power Budget의 메인보드·메모리·저장장치·팬·펌프 값은 `POLICY_DEFAULT`, `LOW` confidence Evidence다. CPU나 GPU peak power가 없으면 계산 결과는 `UNKNOWN`이다.
- Similarity 기본 가중치는 결정론적으로 고정돼 있지만, 실제 Field Evidence가 쌓인 뒤 문제 유형별 보정이 필요하다.
- BuildCores 실제 Schema와 `RAM.speed` 의미는 Task 17에서 다시 확인해야 한다. `RAM.speed → dataRateMtps`는 Provider Adapter 안의 `SOURCE_SEMANTIC_ALIAS`로만 처리해야 한다.

## 다음 작업

사용자 승인 전에는 Checkpoint 3을 시작하지 않는다. 승인받으면 Task 16의 SQLite 저장 계층부터 진행한다.
