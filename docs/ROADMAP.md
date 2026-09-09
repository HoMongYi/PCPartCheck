# Roadmap

## 0.1 공개 기준선

현재 목표는 Canonical/Installation/Evidence/Snapshot 계약, 표준 RuleSet, 결정론적 Identity와 Similarity, BuildCores snapshot adapter, SQLite package, Reference API와 synthetic Demo를 문서와 함께 공개할 수 있는 상태로 고정하는 것입니다. npm publish와 실제 GitHub Release는 별도 승인을 기다립니다.

## 다음에 검토할 일

- 제조사 사양, CPU support, BIOS release, Memory QVL Provider의 실제 구현
- 운영용 Authorization, rate limit, Evidence moderation과 Attachment Storage
- 별도 persistence composition과 migration/backup 운영 절차
- 실제 승인 Evidence가 쌓인 뒤 issue별 Similarity weight 검증
- 추가 Policy Profile과 변경 이력 관리
- npm scope 소유권 확인 뒤 package publish pipeline 설계

## 당장 포함하지 않는 일

실시간 쇼핑몰 가격·재고, 성능·열·소음 예측, LLM 기반 Compatibility 판정, 데이터가 없는 항목의 추정 통과는 현재 범위가 아닙니다. Provider나 Rule을 늘릴 때는 먼저 Public Contract와 라이선스, 재현 가능성을 검토합니다.
