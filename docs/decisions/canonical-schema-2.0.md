# Canonical Spec Schema 2.0

Canonical Schema를 `1.1.0`에서 `2.0.0`으로 올렸다. 기존 PCIe와 전원 커넥터 필드가 서로 다른 뜻을 하나의 값으로 표현하고 있어, 이름만 유지한 채 동작을 바꾸면 과거 Snapshot을 같은 의미로 재생할 수 없기 때문이다.

PCIe 슬롯의 `lanes`는 `physicalLanes`와 `electricalLanes`로 나눴다. GPU의 `pcieLanes`도 `physicalConnectorLanes`와 `maxLinkWidthLanes`로 분리했다. 따라서 물리 x16 GPU를 물리 x16·전기 x8 슬롯에 꽂을 수 있으며, 전기 배선이나 세대 차이는 장착 실패가 아니라 대역폭 경고로 다룬다.

메인보드와 GPU의 소비자 측 `powerConnectors`는 `powerConnectorRequirements`로 바꾸고 각 요구에 `REQUIRED`, `OPTIONAL`, `CONDITIONAL`을 명시한다. 어댑터는 `powerAdapterRequirements`에 입력 커넥터 수와 독립 케이블 수가 기술 자료로 확인된 경우에만 기록한다. PSU의 `powerConnectors`는 공급 능력을 뜻하므로 그대로 유지한다.

캡처카드, NIC, HBA 같은 확장 카드를 표현하기 위해 `PCIE_CARD`를 Canonical Category에 추가했다. 측정된 소비전력이 없으면 Power Budget은 `PowerEstimationPolicy.unknownPcieCardW`를 사용하고 `POLICY_DEFAULT` Evidence를 남긴다.

Schema 1.x Snapshot은 2.0 엔진에서 Replay할 수 없다. 엔진은 기존과 같이 `ReplayVersionMismatchError`를 반환하며 검증을 완화하지 않는다.
