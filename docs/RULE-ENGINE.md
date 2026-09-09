# Rule Engine

Rule은 `ruleId`, `capabilityId`, `evaluate(context)`로 이뤄집니다. Context에는 Canonical Build, Build Intent, typed Installation Context, 해당 Capability 정책만 들어갑니다. Provider raw field를 읽거나 외부 네트워크를 호출하지 않습니다.

## Status

| Status | 뜻 |
|---|---|
| `PASS` | 확인한 정보로 조건을 충족함 |
| `WARNING` | 설치를 막지는 않지만 주의가 필요함 |
| `CONDITIONAL` | 명시한 조건을 지키면 진행할 수 있음 |
| `UNKNOWN` | 검사 대상이나 필수 정보가 모자람 |
| `REVIEW_REQUIRED` | 자동 판정보다 별도 검토가 필요함 |
| `INCOMPATIBLE` | 해당 규칙의 기술 조건을 충족하지 못함 |
| `NOT_CHECKED` | 정책상 꺼져 있거나 적용 대상이 없음 |

전체 Status는 실행한 Rule 중 가장 강한 상태를 보존합니다. 이것은 소비자 행동을 정하는 Decision과 다릅니다.

## Capability와 Decision

Capability mode는 `REQUIRED`, `ADVISORY`, `DISABLED` 가운데 하나입니다. REQUIRED `INCOMPATIBLE`만 `BLOCK`을 만듭니다. ADVISORY `INCOMPATIBLE`은 전체 Status를 `INCOMPATIBLE`로 남기되 Decision은 `ALLOW_WITH_WARNING`이고, Rule ID는 `advisoryRuleIds`에 들어갑니다.

집계 우선순위는 다음과 같습니다.

1. REQUIRED `INCOMPATIBLE`이 있으면 `BLOCK`
2. REQUIRED `UNKNOWN` 또는 `REVIEW_REQUIRED`가 있으면 `REVIEW`
3. 평가된 REQUIRED Rule이 하나도 없으면 `NO_DECISION`
4. REQUIRED `CONDITIONAL`이 있으면 `ALLOW_IF_CONDITIONS_MET`
5. 나머지 Rule에 `WARNING`이나 ADVISORY 비통과 상태가 있으면 `ALLOW_WITH_WARNING`
6. 그 밖에는 `ALLOW`

Issue ID는 `blockingRuleIds`, `reviewRuleIds`, `advisoryRuleIds`로 따로 보존합니다.

## Coverage

Coverage의 원본은 비율이 아닙니다. Required와 Advisory에는 `total`, `evaluated`, `unknown`, `notChecked`, Disabled에는 `total`, `notChecked`를 저장합니다. UI가 비율이 필요하면 이 숫자로 표시 시점에 계산합니다. 원본 결과를 하나의 퍼센트로 축약하지 않습니다.

## 표준 RuleSet 0.1.0

| 영역 | Rule ID |
|---|---|
| 플랫폼 | `cpu-socket`, `memory-generation`, `memory-capacity`, `motherboard-form-factor` |
| 공간·냉각 | `gpu-clearance`, `cpu-cooler-height`, `psu-length`, `radiator-mount`, `cpu-cooler-socket` |
| 저장장치·PCIe | `m2-slot-compatibility`, `m2-sata-sharing`, `pcie-slot-compatibility`, `pcie-bandwidth-advisory` |
| 전원 | `psu-capacity`, `psu-connectors` |
| 주의 사항 | `fan-header-count`, `fan-header-current`, `rgb-header`, `memory-data-rate-advisory`, `four-dimm-data-rate` |

## Clearance 판정 행렬

`remainingMm = availableMm - requiredMm`로 계산합니다. GPU 10mm, CPU cooler 5mm, PSU 10mm, radiator stack 5mm가 기본 safety margin이며 Capability config의 `safetyMarginMm`로 0 이상의 값을 지정할 수 있습니다.

| 조건 | 결과 |
|---|---|
| `remainingMm < 0` | `INCOMPATIBLE` |
| `0 <= remainingMm < safetyMarginMm` | `CONDITIONAL` + `VERIFY_PHYSICAL_CLEARANCE` |
| `remainingMm >= safetyMarginMm` | `PASS` |

따라서 기본 margin이 0보다 크면 치수가 정확히 같은 경우는 `CONDITIONAL`입니다. margin을 0으로 명시하면 같은 치수도 `PASS`가 됩니다. 필요한 치수나 설치 배치가 없으면 `UNKNOWN`입니다.

## Rule 작성 원칙

정보가 없으면 `UNKNOWN`을 반환합니다. `CONDITIONAL`에는 적어도 하나의 code와 message가 있어야 하고, Evidence ID는 판정 근거가 된 항목만 넣습니다. 새 Rule 절차는 [Adding a Rule](ADDING-A-RULE.md)을 따릅니다.
