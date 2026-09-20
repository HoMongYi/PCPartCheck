# 변경 기록

이 프로젝트는 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 참고하고, 패키지 버전은 Semantic Versioning을 따릅니다. Schema와 RuleSet 같은 별도 계약 버전은 [Versioning 문서](docs/VERSIONING.md)에서 관리합니다.

## [Unreleased]

아직 공개 릴리스에 포함되지 않은 변경입니다.

## [0.2.0] - 준비 중

### Added

- Provider-neutral Knowledge Snapshot과 immutable same-provider supersession
- 명시적 CPU support, minimum BIOS ordinal, PSU form-factor 규칙
- revision/context-aware Field Evidence 4.0과 정상 EngineRule 집계
- Knowledge/Evidence 입력을 보존하는 Result Snapshot 3.0과 Reference Policy 2.0

### Changed

- Canonical Schema 3.1과 Installation Context 2.1에 PSU form factor와 component revision을 추가
- Snapshot 2.0은 v0.1 runtime으로 replay하며 v0.2 runtime은 version mismatch로 거부

## [0.1.0] - 준비 중

### Added

- Provider-neutral Canonical Part Schema와 typed Installation Context
- Capability 정책, 표준 Compatibility RuleSet, Power Budget 계산
- Result Snapshot과 버전 일치 Replay
- Canonical Identity mapping, Exact/Similar Field Evidence
- SQLite reference storage와 BuildCores snapshot Provider
- Optional LLM toolkit, Fastify Reference API, Next.js synthetic Demo

[Unreleased]: https://github.com/HoMongYi/PCPartCheck/compare/v0.1.0...HEAD
[0.2.0]: https://github.com/HoMongYi/PCPartCheck/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/HoMongYi/PCPartCheck/releases/tag/v0.1.0
