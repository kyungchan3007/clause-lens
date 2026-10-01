# 0046 — worker 조항타입·위험도·에러코드 contracts 통일 — PRD

> **이슈:** #131 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02

## 1. 문제 (Problem)
- `apps/worker`가 조항타입(9종)·위험도(high/medium/low)·분석 에러코드를 `@clause-lens/contracts`와 **독립적으로 재정의**하고 있다.
  - `apps/worker/src/lib/extraction-schema.ts`: `CLAUSE_TYPES` 9종 배열 + `riskLevel` enum 리터럴 중복.
  - `apps/worker/src/ports/clause-analyzer.port.ts`: `riskLevel: "high" | "medium" | "low"` 리터럴.
  - `apps/worker/src/lib/errors.ts`·`apps/worker/src/ports/ocr.port.ts`: 에러코드 문자열 리터럴.
  - `apps/worker/src/analysis.processor.ts`: `classify`의 에러코드 리터럴(`ocr_timeout`·`analysis_timeout`·`worker_failed` 등).
  - `packages/db/src/analysis-ops.ts`: `Box` 인터페이스 + `ClauseRisk` 유니온을 contracts와 **구조만 같게** 별도 선언.
- 복제본이 어긋나면(철자·대소문자·추가/삭제) 분석 결과 분류와 DB enum 저장이 contracts(=앱·API 계약)와 불일치한다. **drift 위험**.

## 2. 목표 (Goals)
- G1. worker의 조항타입·위험도·에러코드 **출처를 `@clause-lens/contracts` 단일 소스로 통일**. 값(문자열)은 완전히 불변.
- G2. `Box`·위험도 유니온을 가능 범위에서 단일 소스화 — `packages/db`가 contracts를 참조/재노출.
- G3. contracts에 없는 worker 전용 코드(`stub_disabled_in_production`)는 **값 변경 없이** worker 전용 타입으로 명시 보존.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 조항타입·위험도·에러코드의 **값(문자열) 변경 금지** — 출처만 통일(동작 불변).
- N2. 분석/OCR 런타임 로직·분류 결정 변경 없음(순수 구조 리팩토링).
- N3. `stub_disabled_in_production`를 공개 contracts enum에 승격하지 않음(개발·스텁 전용 코드).

## 4. 사용자 흐름 (User Flow)
해당 없음 — 내부 타입 소스 통일. 사용자 가시 동작·분석 결과 변화 없음.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` PASS (worker 빌드·타입·테스트 포함).
- worker의 조항타입·위험도·에러코드가 contracts에서 import. 중복 정의 제거.

## 6. 제약 (Constraints)
- 서버가 진실의 기준. 값 불일치 시 분석 분류·DB enum 저장 깨짐 → 철자/대소문자 완전 대조 필수.
- contracts는 `dist` 선행 빌드(checks.sh가 worker 타입체크 앞에서 build).

## 7. 미해결 질문 (Open Questions)
- (해결) `stub_disabled_in_production`은 contracts 미승격 → worker 전용 유니온(`WorkerErrorCode`)으로 보존.

## Acceptance
- [x] worker `package.json`에 `@clause-lens/contracts` 의존 추가(`pnpm install`)
- [x] `extraction-schema.ts`가 contracts `clauseTypeSchema`/`CLAUSE_TYPES`·`clauseRiskLevelSchema`를 사용(로컬 `CLAUSE_TYPES` 제거)
- [x] `clause-analyzer.port.ts`의 `riskLevel`이 contracts `ClauseRiskLevel` 사용
- [x] `errors.ts`·`ocr.port.ts`·`analysis.processor.ts`의 에러코드가 contracts `AnalysisErrorCode` 기반(`WorkerErrorCode`로 worker 전용 코드 보존)
- [x] `packages/db`가 contracts를 참조해 `Box`·위험도 유니온 단일 소스화
- [x] 조항타입 9종·위험도 3종·에러코드 철자/대소문자 **완전 동일** 대조 확인
- [x] 게이트(checks.sh) PASS
