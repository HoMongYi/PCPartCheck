# Field Evidence

Field Evidence는 특정 부품과 설치 맥락에서 실제로 관찰한 조립 결과입니다. 현재 Schema version은 `3.0.0`입니다.

## 상태와 수정

새 기록은 `DRAFT`로 만듭니다. DRAFT는 WRITE 권한으로 수정할 수 있지만, `DRAFT → APPROVED`와 `DRAFT → REJECTED`는 별도의 `FIELD_EVIDENCE_MODERATE` 권한이 필요합니다. 승인·반려된 기록은 immutable입니다. 수정본이 필요하면 새 DRAFT를 만들고 `supersedesEvidenceId`로 이전 기록을 연결합니다.

모든 기록에는 opaque principal ID와 생성·수정 시각이 들어갑니다. moderation이 끝나면 moderator ID, 시각, 반려 사유를 따로 남깁니다. Outcome은 `ASSEMBLY_SUCCESS`, `ASSEMBLY_FAILURE`, `CONDITIONAL_SUCCESS`이며 조건부 성공에는 condition이 적어도 하나 있어야 합니다.

## EXACT

Issue type, Canonical Part ID 집합, versioned Installation Context가 같아야 `EXACT`입니다. APPROVED Exact Evidence만 관련 판정에 쓸 수 있습니다.

- 조건 없는 `ASSEMBLY_FAILURE`는 기본적으로 `INCOMPATIBLE`
- 해결 조건이 있는 `CONDITIONAL_SUCCESS`는 `CONDITIONAL`
- `ASSEMBLY_SUCCESS`는 base 결과가 Hard `INCOMPATIBLE`이 아닐 때만 `PASS`

즉, 성공 사례 한 건이 결정론적 Hard Rule 실패를 뒤집지 않습니다.

## SIMILAR

Exact가 아닌 같은 issue type 기록은 similarity profile로 점수를 계산할 수 있습니다. APPROVED record만 대상으로 하고 `similarityScore`, `matchedFields`, `differences`, `reason`을 반환합니다. 정렬은 점수 내림차순, 같은 점수는 Evidence ID 순이며 최대 3건입니다.

Similar Failure는 현재 구성의 호환 불가를 뜻하지 않습니다. Status, Decision, blocking/advisory issue를 만들지 않으며 Demo에도 이 안내를 함께 표시합니다.

## Visibility

Visibility는 `PUBLIC`, `STAFF_ONLY`, `ADMIN_ONLY`입니다. Core와 Similarity 알고리즘은 인증을 모릅니다. API composition이 AuthorizationProvider 결과로 허용 record set을 만든 뒤 알고리즘에 전달합니다. 사용자가 payload에 scope를 넣어 권한을 올릴 수 없습니다.

## Attachment

Attachment reference는 실제 bytes의 SHA-256을 `sha256:<hex>`로 보존하고 크기도 기록합니다. Storage Provider는 put 시 bytes와 checksum/size를 검증해야 합니다. Reference memory 구현은 get에서도 무결성을 다시 확인합니다. 운영에서는 visibility, redaction, malware scan, retention 정책을 갖춘 저장소가 별도로 필요합니다.
