# Rule 추가하기

새 Rule은 지원 범위를 늘리는 Domain 변경입니다. Capability와 Canonical field가 이미 승인된 계약 안에 있는지 먼저 확인하세요. raw Provider field를 읽어야 하거나 Canonical Schema의 breaking change가 필요하면 Rule부터 만들지 않습니다.

## 순서

1. Rule ID와 Capability ID, REQUIRED/ADVISORY에서의 기대 결과를 문서로 정합니다.
2. `PASS`, 경계값, `INCOMPATIBLE`, 필수 정보 누락 `UNKNOWN`, 적용 대상 없음 `NOT_CHECKED` 테스트를 먼저 추가해 실패를 확인합니다.
3. `EngineRule`을 최소 구현합니다. 입력은 Canonical Build, Build Intent, typed Installation Context, resolved Capability policy뿐입니다.
4. `CONDITIONAL`이면 실행 가능한 condition code와 message를 넣습니다.
5. 표준 배열에 등록하고 Reference Profile mode를 명시합니다.
6. REQUIRED/ADVISORY 집계 회귀와 Snapshot replay를 확인합니다.
7. Rule behavior가 바뀌었다면 RuleSet version을 올리고 Changeset과 문서를 갱신합니다.

## 완료 조건

데이터 부족이 `PASS`가 되지 않아야 합니다. ADVISORY 실패만으로 `BLOCK`이 되면 안 됩니다. Similar Evidence는 Rule 결과에 들어오지 않습니다. `corepack pnpm check:deps`, typecheck, lint, 관련 unit/integration test가 모두 통과해야 합니다.

현재 Status와 Decision 집계는 [Rule Engine 문서](RULE-ENGINE.md)에 있습니다.
