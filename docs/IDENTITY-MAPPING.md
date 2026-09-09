# Identity Mapping

Canonical Part ID는 import할 때마다 새로 만들지 않습니다. 같은 공급처의 `externalId`에 확정된 `ExternalMapping`이 있으면 기존 `partId`를 먼저 재사용합니다.

## 결정 순서

1. 같은 source와 external ID의 기존 mapping
2. 정규화한 MPN, GTIN, EAN, UPC 같은 product identifier
3. manufacturer, model, critical specification의 정확한 일치
4. 비슷한 이름 후보가 있으면 `REVIEW_REQUIRED`
5. 기존 후보가 없을 때만 새 UUID 생성

확정 mapping이라도 category나 critical specification이 충돌하면 `REJECTED`, 이름이 더는 합리적으로 닮지 않으면 `REVIEW_REQUIRED`입니다. 식별자가 여러 Canonical Part에 걸리면 하나를 임의로 고르지 않습니다.

## 안정성 계약

Importer upsert는 `source + externalId` mapping과 Canonical identity를 함께 조회해야 합니다. 재Import에서는 `createPartId`가 호출되지 않는 것이 정상입니다. 신규 record에만 UUID를 만들고 mapping의 `matchedAt`, `mapperVersion`, match method를 기록합니다.

현재 Identity Mapper version은 `1.1.0`입니다. 문자열 정규화나 match 순서처럼 동일 입력의 결정 결과를 바꾸는 수정은 이 버전을 올리고 Snapshot replay 영향도 검토해야 합니다.

## LLM과 Similarity

LLM은 결정론적 mapper가 이미 내놓은 후보의 순서를 제안할 수 있지만 새 후보를 만들거나 확정 mapping을 쓸 수 없습니다. Field Evidence Similarity 점수도 제품 Identity를 확정하는 근거가 아닙니다.
