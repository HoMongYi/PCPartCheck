# 보안 정책

## 지원 범위

공개 릴리스 전에는 현재 기본 브랜치의 최신 코드만 보안 수정을 받습니다. `0.1.0` 릴리스 뒤에는 지원 중인 버전을 이 문서에 표로 명시하겠습니다.

## 취약점 제보

민감한 취약점은 공개 Issue에 exploit, token, 실제 사용자 데이터와 함께 올리지 마세요. GitHub 저장소의 Security 탭에서 비공개 vulnerability report를 보내는 방식을 우선합니다. 해당 기능을 사용할 수 없다면 저장소 소유자에게 비공개 연락 수단을 요청하는 Issue를 최소한의 정보만 담아 남겨 주세요.

제보에는 영향을 받는 commit 또는 version, 재현 조건, 예상 영향, 가능한 완화 방법을 포함해 주세요. 실제 credential이나 개인정보는 보내지 않습니다. 접수 여부와 공개 시점은 확인 뒤 조율합니다.

## 운영 시 주의할 점

Reference API의 memory authorization과 rate limiter, memory attachment storage는 계약을 보여 주기 위한 구현입니다. 운영 인증·권한·rate limit·파일 저장소를 대신하지 않습니다. Field Evidence attachment를 외부에 제공할 때는 visibility와 redaction을 API 계층에서 확인하고, object storage key나 내부 경로를 직접 노출하지 않아야 합니다.

LLM Adapter에는 Result Snapshot과 필요한 설명 입력만 전달하세요. LLM 응답은 신뢰할 수 없는 외부 입력으로 다루며, deterministic Status·Decision·Identity를 변경하는 데 사용하면 안 됩니다.
