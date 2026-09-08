# Field Evidence 3.0 상태와 첨부 계약

Field Evidence Schema를 `2.0.0`에서 `3.0.0`으로 올렸다. 승인된 기록을 일반 수정 권한으로 바꿀 수 있었고, 조립 실패에 조건을 붙여 조건부 성공처럼 해석하던 문제가 있어 기존 계약을 그대로 유지할 수 없었다.

기록은 `DRAFT`일 때만 수정할 수 있다. `DRAFT → APPROVED`, `DRAFT → REJECTED` 전이는 별도의 moderation 권한으로만 처리한다. `APPROVED`와 `REJECTED`는 이후 수정하거나 다시 승인할 수 없다. 내용을 고쳐야 하면 새 `DRAFT`를 만들고 `supersedesEvidenceId`로 이전 기록을 연결한다.

생성자와 생성·수정 시각은 모든 기록에 남는다. 승인이나 반려가 끝난 기록에는 moderator의 opaque principal ID와 처리 시각도 기록한다. 반려 사유를 비롯한 moderation 사유는 선택값이다. 이메일이나 이름처럼 개인을 바로 알아볼 수 있는 정보는 감사 필드에 넣지 않는다.

Outcome은 `ASSEMBLY_SUCCESS`, `ASSEMBLY_FAILURE`, `CONDITIONAL_SUCCESS` 세 가지다. `CONDITIONAL_SUCCESS`에는 조건이 한 개 이상 있어야 한다. 조립 실패에 조건을 덧붙이는 옛 표현은 Schema에서 거부한다. Exact Evidence를 적용할 때 실패는 `INCOMPATIBLE`, 조건부 성공은 `CONDITIONAL`로 처리한다.

사진과 파일은 Evidence Record 안에 저장하지 않는다. Record에는 checksum과 media type, 크기, opaque storage key가 든 `AttachmentReference`만 연결한다. 실제 바이트는 `AttachmentStorageProvider`가 맡는다. 공개 Reference API는 메모리 저장소와 합성 데모 이미지 한 장만 제공하며, 첨부 조회에도 Evidence와 같은 visibility 권한을 적용한다.
