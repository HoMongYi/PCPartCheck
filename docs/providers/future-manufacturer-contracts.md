# 제조사 BIOS·QVL Provider 확장 계약

v0.1에는 제조사 사이트 수집기나 Scraper를 넣지 않는다. 대신 Provider를 나중에 연결할 때 Core나 Rule 계약을 다시 깨지 않도록 역할과 결과 형식만 먼저 고정했다.

`ManufacturerSpecificationProvider`는 Canonical Part만 반환한다. `CpuSupportProvider`, `BiosReleaseProvider`, `MemoryQvlProvider`는 각각 CPU 지원 목록, BIOS 릴리스, 메모리 QVL 기록을 반환한다. 모든 기록에는 Provider와 버전, 원문 위치, Evidence ID, 확인 시각을 남긴다. Rule이 제조사 웹페이지의 raw field를 직접 읽는 구조는 허용하지 않는다.

CPU 지원 기록은 메인보드와 CPU의 Canonical Part ID, 지원 여부, 필요한 경우 최소 BIOS 버전을 담는다. BIOS 릴리스는 메인보드 ID와 BIOS 버전, 확인된 CPU 목록을 담을 수 있다. QVL 기록은 Canonical Memory Part ID나 MPN 중 하나를 반드시 가져야 하며, 용량, 모듈 수, 시험 데이터 전송률, 시험 구성을 함께 기록한다.

Reference API에는 `manufacturer-specification`, `cpu-support`, `bios`, `qvl` capability가 보이지만 `providerAvailable: false`와 `defaultMode: DISABLED`로 표시된다. 실제 Provider가 없는 상태에서 호환성 결과를 만들지 않는다.
