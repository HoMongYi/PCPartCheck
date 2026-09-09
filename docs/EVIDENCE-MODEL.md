# Evidence Model

PCPartCheck에서 Evidence는 “왜 이 값과 결과가 나왔는가”를 남기는 데이터입니다. Canonical Part 자체와 분리해 원본 출처, 변환 과정, 현장 기록을 보존합니다.

## Provider field audit

Provider adapter는 각 매핑에 `sourcePath`, `targetPath`, `rawValue`, 원본 단위, Canonical 값·단위, `mappingKind`, `mappingRule`, `mapperVersion`을 남길 수 있습니다. 단위 변환은 `UNIT_NORMALIZATION`, 공급처 고유 의미 해석은 `SOURCE_SEMANTIC_ALIAS`로 구분합니다.

BuildCores `RAM.speed`는 후자입니다. 원본 Schema에는 MHz라고 쓰여 있지만 데이터가 판매 사양 DDR data rate를 나타내므로 Adapter 내부에서만 `dataRateMtps`로 옮깁니다. Unit Normalizer에는 일반 MHz→MT/s 변환이 없습니다.

## Field Evidence

Field Evidence는 실제 설치에서 확인한 성공, 실패, 조건부 성공 기록입니다. 부품 ID와 versioned Installation Context가 모두 같은 `EXACT` 기록만 판정에 영향을 줄 수 있습니다. `SIMILAR` 기록은 조회용 참고 자료입니다. 상세 상태 전이와 visibility는 [Field Evidence 문서](FIELD-EVIDENCE.md)에 있습니다.

## Attachment

Evidence에는 attachment bytes 대신 `attachmentId`, media type, `sha256:<hex>`, 크기, opaque storage key를 담은 reference만 둡니다. `AttachmentStorageProvider`가 bytes 저장을 맡습니다. Memory reference 구현은 put과 get에서 SHA-256과 크기를 확인하고, 반환 bytes를 복사해 저장본이 호출자 변경의 영향을 받지 않게 합니다.

## Snapshot

검사 시점에 적용한 Evidence는 Result Snapshot의 `evidenceSnapshot`에 복사됩니다. 원본 저장소가 나중에 바뀌어도 Replay 입력은 기록된 Snapshot을 사용합니다. Evidence의 출처나 visibility를 생략한 채 결과만 저장하면 같은 판정을 재현할 수 없으므로 지원하지 않습니다.

## 신뢰 경계

Provider 원본 검증 실패 record는 Canonical mapping을 하지 않습니다. DRAFT와 REJECTED Field Evidence도 판정 근거가 될 수 없습니다. LLM이 만든 문장은 Evidence outcome이나 deterministic result를 만들지 못합니다.
