# Canonical Schema 1.1.0 결정

- 상태: 승인
- 결정일: 2026-09-08

## 배경

Task 9에서 PSU와 케이스의 길이 간섭을 판정하려고 `PsuSpec.lengthMm`을 추가했다. 필드는 optional이지만 Canonical Schema의 공개 구조가 달라졌으므로 Schema 버전에도 이 변경을 표시해야 한다.

## 결정

`CANONICAL_SCHEMA_VERSION`을 `1.0.0`에서 `1.1.0`으로 올린다. 엔진과 npm package 버전 `0.1.0`은 별도 계약이므로 그대로 둔다.

1.1.0에서도 `lengthMm`이 없는 PSU 입력은 유효하다. 값이 있다면 0보다 큰 숫자이고, 단위 정규화를 마친 mm 값이어야 한다. 1.0.0 Snapshot은 1.1.0 엔진에서 자동 변환하지 않으며 Replay 단계에서 `ReplayVersionMismatchError`로 거부한다.

## 영향

새 Snapshot에는 `canonicalSchemaVersion: 1.1.0`이 저장된다. 과거 결과를 다시 실행해야 한다면 당시 1.0.0 Schema와 엔진을 함께 사용해야 한다. Provider는 raw 길이 값을 Canonical Part에 넣기 전에 Unit Normalization을 거쳐야 한다.
