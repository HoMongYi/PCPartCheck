# BuildCores OpenDB Provider

## 확인한 원본

Task 17 구현을 시작한 2026-09-08에 BuildCores OpenDB의 `main`을 다시 확인했다.

- 저장소: `https://github.com/buildcores/buildcores-open-db`
- commit: `547b32703b370142f17b09c3047c80dc88ba5260`
- `open-db` tree: `5f24e13c06d496af9eab38bf63d06afd80be1d91`
- `schemas` tree: `cc15acdcf8cec85d36b267fd6c201eff754cf624`
- 라이선스: ODC-By 1.0

Checkpoint 3.5에서 최신 main을 다시 읽었다. `/open-db/{category}/{UUID}.json`, `/schemas/*.schema.json`, `opendb_id`, `metadata`, `identifiers` 구조는 유지됐지만 데이터 commit은 갱신됐다. Schema tree는 이전 조사와 같은 SHA였다.

Pre-Checkpoint 4 검증에는 `a3795382f9e73c283e3592a8c972842fd0e72e22`를 사용했다. 이 commit의 Schema tree도 `cc15acdcf8cec85d36b267fd6c201eff754cf624`로 같았다.

## Snapshot 방식

Provider는 BuildCores 데이터 전체를 이 저장소에 복사하지 않는다. 사용자가 별도로 준비한 특정 commit의 local snapshot을 읽고, 그 안의 `/schemas` 파일을 직접 검사한다. 파일 경로와 UTF-8 본문을 정렬한 뒤 SHA-256을 계산하며, Windows와 Linux에서 결과가 달라지지 않도록 줄바꿈은 LF로 맞춘다. 예상 fingerprint와 실제 값이 다르면 레코드를 읽기 전에 import를 중단한다.

고정 commit의 `/schemas` 전체 31개 파일을 같은 방식으로 계산한 값은 `sha256:a33ac0906b264ab6a3efc92bc4e27911852dcfe1d01fcdc50a23349dab3fb93c`다. 오프라인 테스트 fixture에는 현재 지원하는 9개 category의 공식 Schema 원문만 포함했으며, 이 부분 snapshot의 fingerprint는 `sha256:2c0a21f04687effb7445574465a769ed83bb9f50149880157e7f2dea92505bf9`다.

지원 category의 레코드는 해당 snapshot에 들어 있는 BuildCores JSON Schema를 통과해야 Adapter로 넘어간다. JSON 자체가 깨졌으면 `INVALID_JSON`, Source Schema를 어겼으면 `SOURCE_SCHEMA_VALIDATION_FAILED`로 기록한다. 매핑이 끝난 값도 `CanonicalPartSchema` runtime 검증을 통과해야 `IMPORTED`가 되며, 여기서 실패하면 `CANONICAL_SCHEMA_VALIDATION_FAILED`로 구분한다. 필수 원본이 없거나 뜻이 불분명한 값은 추정하지 않고, Canonical 최소 필드가 부족하면 `SKIPPED`로 남긴다.

## 카테고리별 Coverage

| BuildCores 카테고리 | 상태 | 안전하게 매핑하는 필드 | 비워 두는 필드와 이유 |
|---|---|---|---|
| CPU | 지원 | socket, core/thread count, TDP, PPT, memory technology | 세부 clock/cache는 현재 Canonical 대상이 아님 |
| Motherboard | 지원 | socket, form factor, chipset, memory type/slot/capacity, M.2, RGB, USB | `pcie_slots[].lanes`는 physical/electrical 구분이 없어 생략. 추가 EPS의 필수 여부도 없어 전원 요구 생략. Fan header는 connector/current가 없어 생략 |
| RAM | 지원 | type, DIMM form factor, module count/capacity, data rate alias, height | 실제 clock은 만들지 않음 |
| GPU | 지원 | length, slot width, PCIe generation/max link width, 필수 외부 전원 커넥터 | interface의 x값으로 physical connector를 추정하지 않음. TDP를 peak power로 바꾸지 않음. Adapter 입력 수와 권장 PSU 정보가 없음 |
| CPUCooler | 조건부 지원 | socket, AIR/AIO type, height, radiator size | water-cooled인데 radiator size가 없으면 AIO와 custom loop를 구분할 수 없어 skip. 두께와 peak power가 없음 |
| PCCase | 지원 | motherboard/PSU form factor, GPU/cooler/PSU clearance, expansion slot count | radiator 위치별 두께 한계가 없어 radiator mount는 생략 |
| PSU | 지원 | form factor, rated power, length, 제공 커넥터 수 | connector 객체가 없으면 빈 목록으로 바꾸지 않고 미확인으로 둠. ATX version과 12V-2x6 구분 정보는 만들지 않음 |
| Storage | 지원 | HDD/SATA SSD/NVMe SSD, capacity, interface, M.2 form factor | 장치 M.2 Key, peak power, M.2/SATA 공유 조건이 없어 해당 값은 미확인으로 둠 |
| CaseFan | 부분 지원 | size, PWM/DC connector | thickness/current/power가 없으면 채우지 않음. 두께가 필요한 판정은 `UNKNOWN`을 유지함 |

지원하는 필드가 일부 비어 있으면 관련 Rule이 `UNKNOWN`을 반환한다. 원본 connector 객체가 있으면서 수량이 모두 0인 경우에만 빈 배열을 만들고, 객체 자체가 없으면 필드를 생략한다. Provider가 값을 추정해서 `PASS`를 만들지는 않는다.

## RAM.speed 처리

RAM Schema는 `speed`를 MHz라고 설명하지만 예시는 6000, 3200이며, 실제 데이터도 제품명 `DDR5-6400`과 `speed: 6400`을 함께 사용한다. 이 값은 실제 3200MHz clock이 아니라 판매 사양의 DDR data rate다.

따라서 BuildCores Adapter 안에서만 `SOURCE_SEMANTIC_ALIAS`를 적용해 `dataRateMtps`로 옮긴다. Audit에는 원본 field `speed`, 원본 unit `MHz`, raw value, `BUILDCORES_RAM_SPEED_MARKETED_DATA_RATE`, mapperVersion을 모두 보존한다. `clockMHz`는 만들지 않으며 Unit Normalizer에도 MHz→MT/s 규칙을 추가하지 않는다.

## Attribution

Provider는 ODC-By 1.0 Attribution 메타데이터를 import report에 포함한다. 공개 사용 시에는 저장소의 `ATTRIBUTION.md`와 Demo 화면의 출처 고지를 함께 유지해야 한다.
