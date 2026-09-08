# Canonical Spec Schema 3.0과 Installation Context 2.0

Canonical Schema를 `2.0.0`에서 `3.0.0`으로 올렸다. 이번 변경은 새 규격을 몇 개 더 받기 위한 확장이 아니다. 값이 없는 상태와 실제로 `0`개이거나 `없음`으로 확인된 상태를 구분하기 위한 계약 변경이다. 이 구분이 없으면 Provider에 필드가 없을 때도 Rule이 빈 배열로 받아 잘못된 `PASS`를 만들 수 있다.

PSU의 `powerConnectors`와 GPU·메인보드·PCIe 카드의 전원 요구 목록은 이제 생략할 수 있다. 생략은 미확인, 빈 배열은 커넥터가 없다고 확인된 상태다. Storage에는 `m2Key`를 추가했다. 장치 Key는 `B`, `M`, `B_M`만 허용하고, 슬롯은 여기에 `E`를 더해 무선 모듈용 슬롯도 정확히 표현한다. Case Fan의 두께는 선택값으로 바꿨다. 지름과 커넥터만 확인된 팬은 가져오되, 두께가 필요한 판정에서는 `UNKNOWN`을 유지한다.

Installation Context는 `2.0.0`으로 올렸다. 라디에이터 배치, HDD 케이지, GPU 방향, 점유 PCIe 슬롯, PCIe 전원 연결 정보는 모두 선택값이다. 필드가 없으면 아직 확인하지 못한 것이고, `[]`, `0`, `false`가 들어 있으면 확인된 값이다. 라디에이터와 팬 두께도 각각 모를 수 있으므로 선택값으로 둔다.

Result Snapshot 형식은 `2.0.0`이며 `installationContextSchemaVersion`을 별도로 기록한다. 엔진은 Canonical Schema나 Installation Context 버전이 다르면 Replay를 거부한다. 예전 Snapshot을 새 의미로 조용히 해석하지 않는다.
