# Optional LLM Integration

LLM은 PCPartCheck의 판정 엔진 바깥에 있습니다. 연결하지 않아도 모든 Compatibility Rule, Snapshot replay, Identity mapping, API와 Demo test가 동작합니다.

## 허용하는 역할

- 결정론적 Rule summary와 reason을 사용자 대상 문장으로 설명
- 결정론적 mapper가 제시한 Identity 후보 순서 제안
- 자연어 요청을 versioned Build Intent로 구조화
- 원문을 보존한 채 Field Evidence note 요약과 관찰 사실 정리

## 금지하는 역할

LLM은 Status, Decision, verdict, outcome을 생성하거나 바꿀 수 없습니다. 알려진 Canonical Part ID 밖의 ID를 만들거나, Identity를 확정하거나, Exact/Similar 분류를 바꾸거나, validation을 우회할 수도 없습니다.

Toolkit은 LLM 입력에 허용된 Rule과 후보만 전달합니다. 응답에 `status`, `decision`, `verdict`, `overall` 같은 금지 필드가 있거나 Schema가 맞지 않으면 `INVALID_RESPONSE`입니다. Adapter가 없으면 `UNAVAILABLE`이며 결정론적 결과는 그대로 남습니다.

## 운영 권고

외부 모델에 보내는 정보는 필요한 범위로 줄이고 credential, private attachment URL, 고객 식별자를 포함하지 마세요. model/provider version과 prompt contract가 설명 품질을 바꾸더라도 Result Snapshot의 deterministic version domain과 섞지 않습니다.
