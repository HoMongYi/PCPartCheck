# Knowledge Snapshot

Knowledge Snapshot `1.0.0`은 CPU 지원과 BIOS release처럼 부품 사이에 존재하는 관계형 사실을 provider-neutral 형태로 전달하는 immutable 계약입니다. Canonical Part 안에 관계 배열을 넣지 않으며 Rule은 source raw field를 읽지 않습니다.

## Identity와 provenance

각 snapshot은 `snapshotId`, provider ID/version, optional data revision/schema fingerprint, `collectedAt`을 가집니다. Source는 stable `sourceId`, durable URI, capture time, content hash와 Evidence ID를 보존합니다. 모든 relation은 하나 이상의 `sourceId`를 가리키며 Result의 `knowledgeRelationIds`에서 relation과 source까지 역추적할 수 있습니다.

Snapshot과 source ID는 전체 입력에서 유일해야 합니다. dangling source reference, durable provenance 누락, relation identity 중복은 Rule 실행 전에 거부합니다. Canonicalization은 snapshot/source/relation ID로 결정론적으로 정렬하고 입력 object를 수정하지 않습니다.

## Supersession과 active leaf

새 snapshot은 같은 provider의 기존 snapshot만 `supersedesSnapshotId`로 가리킬 수 있습니다. 기존 snapshot을 덮어쓰지 않고 둘 다 replay input에 보존합니다. dangling edge, cross-provider edge, self edge와 cycle은 invalid입니다.

평가에는 supersession chain의 active leaf를 사용합니다. 서로 다른 provider는 동등한 권한의 독립 snapshot이며 provider name, 최신 시각이나 confidence로 한쪽을 임의 선택하지 않습니다. active relation이 충돌하면 `REVIEW_REQUIRED`입니다.

## CPU support와 BIOS

CPU support relation은 motherboard와 CPU의 Canonical Part ID, category, hardware revision, 명시적 `SUPPORTED` 또는 `UNSUPPORTED`, BIOS requirement를 보존합니다. Relation 부재는 `UNSUPPORTED`가 아니며 `UNKNOWN`입니다.

BIOS requirement는 `NONE`, `UNKNOWN`, `MINIMUM`을 구분합니다. `MINIMUM`은 같은 snapshot의 BIOS release relation을 가리킵니다. Runtime은 Installation Context의 installed BIOS string을 같은 motherboard/revision release에 정확히 매핑한 뒤 provider가 부여한 `releaseOrdinal`만 비교합니다. BIOS 문자열 자체를 정렬하거나 provider별 naming convention을 추측하지 않습니다.

## Replay와 운영 경계

Result Snapshot `3.0.0`은 정규화된 Knowledge Snapshot과 `knowledgeSnapshotSchemaVersion`을 보존합니다. Snapshot `2.0.0`에는 Knowledge와 Evidence Policy 입력이 없으므로 v0.2 runtime에서 replay하지 않습니다.

Reference 구성은 `example.invalid` provenance와 synthetic part identity만 사용합니다. 실제 source adapter, catalog request, QVL 판정은 v0.2 release candidate 범위에 포함하지 않습니다.
