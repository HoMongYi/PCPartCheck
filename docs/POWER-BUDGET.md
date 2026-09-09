# Power Budget

Power Budget은 부품별 부하를 합산하고 PSU 여유 폭을 계산하는 결정론적 정책입니다. 성능 벤치마크나 전력 시뮬레이션은 아닙니다.

## 입력 부하

CPU와 GPU는 `peakPowerW`가 있어야 합니다. 하나라도 없으면 결과는 `UNKNOWN / CPU_OR_GPU_PEAK_POWER_MISSING`입니다. 메인보드, 메모리, peak가 없는 저장장치·팬·펌프·PCIe card는 기본 allowance를 씁니다.

| 항목 | 기본값 |
|---|---:|
| 메인보드 | 70W |
| 메모리 모듈 1개 | 5W |
| NVMe SSD | 8W |
| SATA SSD | 5W |
| HDD | 10W |
| Case Fan | 5W |
| Pump | 20W |
| 미확인 PCIe card | 25W |

Allowance는 `PowerEstimationPolicy`로 교체할 수 있습니다. 기본값을 쓴 각 부하는 `POLICY_DEFAULT`, source ID `power-estimation-v1`, LOW confidence Evidence를 남깁니다.

## 계산식

기본 sizing policy는 headroom 20%, 최소 reserve 100W, 올림 단위 50W입니다. `ceilStep(x)`는 x를 50W 단위로 올림합니다.

```text
estimatedPeakPowerW = sum(componentLoads)
minimumPsuW = ceilStep(estimatedPeakPowerW + 100W)
calculatedRecommendedPsuW = ceilStep(max(
  minimumPsuW,
  estimatedPeakPowerW / (1 - 0.20)
))
recommendedPsuW = ceilStep(max(
  calculatedRecommendedPsuW,
  maxGpuVendorRecommendedPsuW 또는 0
))
```

GPU 제조사 권장값이 계산값보다 클 때 `selectedBy`는 `VENDOR`, 아니면 `CALCULATED`입니다.

## 판정

선택한 PSU 정격이 `minimumPsuW`보다 작으면 `INCOMPATIBLE`, minimum 이상 recommended 미만이면 `CONDITIONAL`, recommended 이상이면 `PASS`입니다. PSU 커넥터 공급 여부는 별도 `psu-connectors` Rule이 구조화된 `PowerConnectorSpec`으로 검사합니다. 용량이 맞는다고 케이블 구성까지 통과한 것으로 보지 않습니다.
