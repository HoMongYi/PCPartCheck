# Provider SDK

Provider SDK는 외부 기술 사양을 PCPartCheck에 연결할 때 지켜야 할 최소 계약입니다. Provider는 raw record를 Core Rule에 넘기지 않고, 검증·정규화·Identity mapping을 거쳐 Canonical Part를 반환해야 합니다.

## 공통 계약

`TechnicalCatalogProvider<TSnapshot, TReport>`는 `providerId`, Attribution, `importSnapshot`을 정의합니다. Attribution에는 source name/URL, license/URL, 고지 문구가 들어갑니다. Mapping audit의 종류는 `DIRECT`, `UNIT_NORMALIZATION`, `SOURCE_SEMANTIC_ALIAS`입니다.

Provider version에는 adapter version을 쓰고, Result Snapshot의 `providerVersions`에는 실제 data commit과 schema fingerprint도 함께 남길 수 있습니다. 같은 adapter라도 data commit이 다르면 별도 재현 정보가 필요합니다.

`KnowledgeSnapshotProvider.loadKnowledgeSnapshots(query)`는 provider-neutral immutable snapshot만 반환합니다. Query는 part reference와 optional collection bound를 전달하며, 구현은 저장된 fixture나 record의 mutable reference를 호출자에게 노출하지 않아야 합니다. Runtime은 source provenance와 same-provider supersession을 검증한 뒤 active leaf를 Rule에 전달합니다.

## 제조사 Provider 확장점

다음 interface와 runtime schema가 준비돼 있습니다.

- `ManufacturerSpecificationProvider`
- `CpuSupportProvider`
- `BiosReleaseProvider`
- `MemoryQvlProvider`

Reference API는 합성 Knowledge fixture로 CPU support와 BIOS Rule 계약을 보여 줍니다. 실제 source adapter는 연결하지 않았으며, interface가 있다는 이유만으로 지원 여부를 추정하지 않습니다. QVL capability는 계속 `DISABLED`입니다.

## Provider 구현 순서

원본 라이선스 확인, version pin, source runtime validation, unit normalization, identity resolution, Canonical runtime validation, audit/attribution 생성 순서로 구현합니다. 실패 record는 원본 검증, mapping skip, Canonical 검증 실패를 구분해야 합니다.

BuildCores 구현과 snapshot 절차는 [BuildCores 문서](providers/buildcores.md), 새 Provider 체크리스트는 [Adding a Provider](ADDING-A-PROVIDER.md)를 참고하세요.
