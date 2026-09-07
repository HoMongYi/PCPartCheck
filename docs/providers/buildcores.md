# BuildCores OpenDB Provider

## 확인한 원본

Task 17 구현을 시작한 2026-09-08에 BuildCores OpenDB의 `main`을 다시 확인했다.

- 저장소: `https://github.com/buildcores/buildcores-open-db`
- commit: `a3795382f9e73c283e3592a8c972842fd0e72e22`
- commit 시각: `2026-09-07T18:28:47Z`
- `open-db` tree: `46602e362b6b7e9d9f9bdbc88bd7f6a7a0107aff`
- `schemas` tree: `cc15acdcf8cec85d36b267fd6c201eff754cf624`
- 라이선스: ODC-By 1.0

조사 때 사용한 commit `ce2e22b85a3b9a5ee10c28fd8a457b9b536eeff1` 이후 자동 동기화 commit이 한 번 추가됐다. `/open-db/{category}/{UUID}.json`, `/schemas/*.schema.json`, `opendb_id`, `metadata`, `identifiers` 구조는 그대로여서 Stop 조건에 해당하는 차이는 없었다.

## Snapshot 방식

Provider는 BuildCores 데이터 전체를 이 저장소에 복사하지 않는다. 사용자가 별도로 준비한 특정 commit의 local snapshot을 읽으며, import 결과에는 commit SHA와 Schema tree fingerprint가 남는다. 테스트는 같은 디렉터리 구조의 작은 fixture만 사용하므로 live 저장소가 없어도 실행할 수 있다.

현재 Adapter는 실제 Schema를 확인한 CPU와 RAM만 Canonical Part로 변환한다. 다른 카테고리는 추측해서 채우지 않고 `SKIPPED / UNSUPPORTED_CATEGORY`로 보고한다. CPU나 RAM도 Canonical 필수 필드가 부족하면 `SKIPPED`, source identity가 잘못됐으면 `FAILED`다.

## RAM.speed 처리

RAM Schema는 `speed`를 MHz라고 설명하지만 예시는 6000, 3200이며, 실제 데이터도 제품명 `DDR5-6400`과 `speed: 6400`을 함께 사용한다. 이 값은 실제 3200MHz clock이 아니라 판매 사양의 DDR data rate다.

따라서 BuildCores Adapter 안에서만 `SOURCE_SEMANTIC_ALIAS`를 적용해 `dataRateMtps`로 옮긴다. Audit에는 원본 field `speed`, 원본 unit `MHz`, raw value, `BUILDCORES_RAM_SPEED_MARKETED_DATA_RATE`, mapperVersion을 모두 보존한다. `clockMHz`는 만들지 않으며 Unit Normalizer에도 MHz→MT/s 규칙을 추가하지 않는다.

## Attribution

Provider는 ODC-By 1.0 Attribution 메타데이터를 import report에 포함한다. 공개 사용 시에는 저장소의 `ATTRIBUTION.md`와 Demo 화면의 출처 고지를 함께 유지해야 한다.
