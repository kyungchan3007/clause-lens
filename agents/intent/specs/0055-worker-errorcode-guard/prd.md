# PRD — errorCode 영속/응답 경계 가드(공개 계약 밖 코드 치환)

> **이슈:** #133 · 상태: in-progress · 유형: refactor(방어적 하드닝) · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
PR#132 리뷰 후속. worker 전용 비상 코드 `stub_disabled_in_production`(stub OCR·stub 분석 어댑터가 비프로덕션 전용 가드로 throw)이 **공개 계약 `ANALYSIS_ERROR_CODES`(@clause-lens/contracts) 밖** 값이면서 `FailDecision.errorCode`(`WorkerErrorCode = AnalysisErrorCode | "stub_disabled_in_production"`)로 흐른다.

- 경로: stub 어댑터 throw(`OcrPermanentError`/`AnalysisPermanentError("stub_disabled_in_production")`) → `classify()`가 `e.code`를 그대로 반환 → `confirmPageAnalysisTx`의 `outcome.errorCode`(타입 `string`) → DB `PageAnalysis.errorCode` 컬럼 저장 → `analysis.mapper`가 무검증 캐스팅으로 응답에 노출.
- 즉 **계약 밖 문자열이 DB·API 응답에 새어나갈 이론적 경로**가 존재한다. stub은 비프로덕션 전용이라 실위험은 낮지만, 영속/응답 경계에 런타임 검증이 없다.

## 2. 목표 (Goals)
- G1. errorCode를 DB에 쓰는 **영속 경계**(`packages/db` analysis-ops의 confirm/fail 경로)에서 `ANALYSIS_ERROR_CODES` 소속 여부를 런타임 검증 — 속하면 그대로, 아니면 안전 기본 `AnalysisErrorCode`(`analysis_failed`)로 치환.
- G2. **worker 경계**(errorCode를 넘기는 지점)에서도 동일 치환 — worker가 계약 밖 코드를 애초에 방출하지 않도록 `FailDecision.errorCode` 타입을 `AnalysisErrorCode`로 좁힘(방어 심화).
- G3. 가드는 `@clause-lens/contracts` 단일 소스로 제공(`coerceAnalysisErrorCode`/`isAnalysisErrorCode`) — db·worker 공유.

## 3. 목표가 아닌 것 (Non-goals)
- N1. **valid 코드 동작 변경** — 계약에 속한 모든 코드(`analysis_failed`·`invalid_image`·`ocr_timeout` 등)는 완전 불변.
- N2. 스키마 큰 변경(errorCode 컬럼을 DB enum으로 전환 등) — 지양. 기존 string 컬럼 유지, 런타임 가드만 추가.
- N3. stub 어댑터·`WorkerErrorCode` 타입 제거 — stub 전용 코드는 worker 내부 분류로 보존(계약 밖 반출만 차단).
- N4. `analysis.mapper`(응답 변환) 로직 변경 — 영속 경계에서 이미 valid만 저장되므로 읽기 측은 안전(가드 불필요).

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(내부 하드닝). 정상·실패 분석 결과 화면 모두 이전과 동일. 오직 "계약 밖 코드가 실수로 저장될 뻔한 비정상 경로"에서만 `analysis_failed`로 안전 치환.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS.
- 기존 worker/db(및 contracts) 테스트가 **무수정 통과**(동작 불변의 증거).
- 계약 밖 코드(stub_disabled_in_production·임의 문자열)가 DB·응답에 도달 불가(가드 단위 테스트로 단언).

## 6. 제약 (Constraints)
Expo v57, 서버가 진실의 기준(프론트는 표현만). errorCode는 사용자용 코드(원문·PII 금지). → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. OCR 유래 실패의 안전 기본값을 `ocr_failed`로 분리할 수도 있으나, 영속 경계는 도메인 맥락이 없어 단일 안전값 `analysis_failed`로 통일(worker 분류가 이미 valid 코드를 직접 지정하므로 치환은 비정상 경로에서만 발생).

### Acceptance
- [x] `@clause-lens/contracts`에 `coerceAnalysisErrorCode(code, fallback="analysis_failed")`·`isAnalysisErrorCode(code)` 추가(단일 소스).
- [x] 영속 경계 `confirmPageAnalysisTx`(packages/db)에서 `outcome.errorCode`를 `coerceAnalysisErrorCode`로 검증·치환.
- [x] worker `classify()`의 permanent 분기(`e.code`=WorkerErrorCode)에서 치환, `FailDecision.errorCode` 타입을 `AnalysisErrorCode`로 좁힘.
- [x] 가드 단위 테스트: valid 코드 passthrough·계약 밖 코드→안전 기본값·비문자열→기본값·fallback 인자 동작.
- [x] worker 통합 테스트: stub OCR/분석 영구 오류(stub_disabled_in_production)가 `analysis_failed`로 치환 종결됨을 단언.
- [x] valid 코드 경로 불변(기존 worker/db/contracts 테스트 무수정 통과).
- [x] `bash agents/harness/evals/checks.sh` PASS.
