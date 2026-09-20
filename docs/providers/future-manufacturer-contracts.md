# 제조사 BIOS·QVL Provider 확장 계약

v0.2 release candidate에는 실제 source adapter를 넣지 않는다. Provider를 나중에 연결할 때 Core나 Rule 계약을 다시 깨지 않도록 역할과 결과 형식만 고정했다.

`ManufacturerSpecificationProvider`는 Canonical Part만 반환한다. source-specific `CpuSupportProvider`와 `BiosReleaseProvider` 출력은 adapter ingress에서 Knowledge Snapshot으로 변환한다. Snapshot에는 Provider/version, collectedAt, durable source URI/hash, relation source ID를 남긴다. Rule이 source raw field를 직접 읽는 구조는 허용하지 않는다.

CPU relation은 motherboard/CPU Canonical Part ID와 hardware revision, 지원 여부, `NONE`·`UNKNOWN`·`MINIMUM` BIOS requirement를 담는다. BIOS release relation은 motherboard identity, revision, opaque version과 provider-issued ordinal을 담는다. QVL은 미래 계약이며 v0.2 판정을 정의하지 않는다.

Reference Policy 2.0은 합성 Knowledge로 `cpu-support`와 `bios`를 REQUIRED로 실행한다. `manufacturer-specification`과 `qvl`은 실제 Provider가 없으므로 DISABLED이며, 외부 사실을 추정해 결과를 만들지 않는다.
