# 외부 데이터 출처

PCPartCheck 소스 코드는 [Apache License 2.0](LICENSE)으로 배포합니다. 아래 외부 데이터와 Schema는 이 코드 라이선스에 포함되지 않습니다.

## BuildCores OpenDB

- 제공자: BuildCores OpenDB contributors
- 원본: [buildcores/buildcores-open-db](https://github.com/buildcores/buildcores-open-db)
- 데이터 라이선스: [Open Data Commons Attribution License 1.0](https://opendatacommons.org/licenses/by/1-0/)
- pinned/reference validation commit: `a3795382f9e73c283e3592a8c972842fd0e72e22`
- 위 commit의 전체 `/schemas` fingerprint: `sha256:a33ac0906b264ab6a3efc92bc4e27911852dcfe1d01fcdc50a23349dab3fb93c`
- 테스트에 포함한 9개 지원 Schema fixture fingerprint: `sha256:2c0a21f04687effb7445574465a769ed83bb9f50149880157e7f2dea92505bf9`
- 현재 문서 확인 시점의 upstream 최신 commit: `932a6cfcb4fbe372bcd0ed600a7e127295d25dee`

`a3795382…`는 importer 검증을 고정한 reference commit입니다. `932a6cfc…`는 2026-09-09에 확인한 upstream HEAD이며, PCPartCheck가 자동으로 승인하거나 사용하는 data commit이 아닙니다. 실제 import 결과에는 사용자가 선택한 data commit과 provider version을 별도로 기록해야 합니다.

BuildCores 원본 데이터 또는 그 파생 데이터를 공개하는 동안 출처, 원본 URL, ODC-By 1.0 고지를 함께 유지해야 합니다. 자세한 snapshot 갱신 절차는 [BuildCores Provider 문서](docs/providers/buildcores.md)에 있습니다.
