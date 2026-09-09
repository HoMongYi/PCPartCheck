# Provider 추가하기

Provider는 외부 데이터의 의미와 라이선스를 Canonical 계약으로 옮기는 경계입니다. 원본 형식을 기억에 의존해 다시 만들지 말고, 공급처가 제공하는 versioned Schema나 공식 계약을 사용하세요.

## 순서

1. 원본 저장소·API의 라이선스, Attribution 요구사항, 이용 제한을 확인합니다.
2. data version 또는 commit을 고정하고 source Schema도 같은 revision에서 가져옵니다.
3. 원본 record를 runtime validation합니다. 실패 record는 mapping하지 않습니다.
4. 단위는 `@pcpartcheck/unit-normalization`으로 바꾸고 raw value/unit을 audit에 보존합니다.
5. 공급처 고유의 의미 해석은 `SOURCE_SEMANTIC_ALIAS`로 Adapter 안에 가둡니다.
6. 기존 `ExternalMapping`과 확정 Identity를 먼저 조회해 stable partId를 재사용합니다.
7. 결과를 `CanonicalPartSchema`로 다시 검증합니다.
8. import/skip/failure reason, mapping audit, attribution, provider version과 data revision을 report에 남깁니다.
9. live 데이터 없이도 실행되는 fixture test를 만듭니다.

Source Schema 실패와 Canonical output 실패는 구분해야 합니다. 값이 없거나 뜻이 모호하면 추정하지 말고 비워 두며, 필요한 Rule이 `UNKNOWN`을 내게 합니다.

BuildCores snapshot에는 [별도 고정 절차](providers/buildcores.md)가 있습니다. fingerprint mismatch를 무시하거나 자동 승인하는 옵션은 추가하지 않습니다.
