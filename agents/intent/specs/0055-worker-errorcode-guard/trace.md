# 0055 — 과정 기록 (trace)

## 판단
- **열린 경로를 전수 확인부터.** `errorCode`가 DB에 쓰이는 지점을 grep으로 모두 수집:
  - `packages/db/src/analysis-ops.ts`: line 216 `"stale_revision"`(리터럴) · **line 232 `outcome.errorCode`(동적)** · line 343 `"stale_revision"`(리터럴) · line 389 `null`.
  - → 동적으로 계약 밖 값이 들어올 수 있는 유일한 쓰기 = line 232. 이것이 영속 chokepoint.
- **왜 열려 있었나(원인).** `PageOutcome.errorCode` 타입이 `string`이고, worker `classify()`가 `OcrPermanentError`/`AnalysisPermanentError`의 `e.code`(타입 `WorkerErrorCode = AnalysisErrorCode | "stub_disabled_in_production"`)를 **그대로** 반환 → `FailDecision.errorCode`도 `WorkerErrorCode` → `confirmPageAnalysisTx`로 전달 → DB 컬럼(string) 저장 → `analysis.mapper`가 무검증 캐스팅 노출. 경계 어디에도 "계약 소속" 런타임 검증이 없었음. stub 어댑터가 비프로덕션 가드로 `stub_disabled_in_production`을 throw하는 것이 유일한 계약 밖 유입원(비프로덕션 전용이라 실위험은 낮음).
- **하드닝 기준: defense-in-depth 2경계.** (1) 영속 chokepoint(db line 232)에 가드 → terminalize·미래 호출자까지 전부 덮음. (2) worker `classify` permanent 분기에도 가드 + `FailDecision.errorCode` 타입을 `AnalysisErrorCode`로 좁힘 → worker가 계약 밖 코드를 타입상·런타임상 애초에 방출 안 함(로그/메트릭도 깨끗). 두 치환은 idempotent라 충돌 없음.
- **치환 선택 근거(`analysis_failed`).** 영속 경계는 OCR/분석 도메인 맥락이 없어 단일 안전값이 필요. `analysis_failed`=「위험조항 분석 영구 실패」로 계약상 "영구 실패·비재시도" 의미에 부합하며 과제 권고값과 일치. OCR 유래를 `ocr_failed`로 분리하는 대안은 경계에 도메인 지식을 주입해야 해 보류(worker 분류가 이미 valid 코드를 직접 지정하므로 치환은 비정상 경로에서만 발생 → 단일값으로 충분).
- **단일 소스 배치.** 가드(`coerceAnalysisErrorCode`·`isAnalysisErrorCode`)를 `ANALYSIS_ERROR_CODES`와 같은 `contracts/src/analysis.ts`에 둠 → db(기존 contracts 의존)와 worker가 공유. db는 기존 `import type`을 value import로 승격(런타임 require 발생, contracts는 이미 workspace 의존이라 안전).
- **valid 불변 보장.** `coerce`는 계약 소속이면 동일 값 반환. `classify`의 `ValidationError.code`(Extract로 valid)·리터럴 분기(`ocr_timeout`·`analysis_timeout`·`worker_failed`)는 치환 안 함 → 기존 테스트(analysis_failed·invalid_image·ocr_failed·analysis_timeout) 그대로 통과.

## 막힘 / 되돌림
- 첫 worker typecheck/test에서 `@clause-lens/infra` 모듈 미해결 — 내 변경과 무관(워크스페이스 dist 미빌드). 게이트 순서대로 `infra` build 선행 후 worker typecheck EXIT 0·테스트 통과 확인.
- `FailDecision.errorCode`를 `AnalysisErrorCode`로 좁히자 `WorkerErrorCode` import가 미사용 → processor에서 제거.

## 검증 결과
- contracts build·test: PASS(신규 `error-code-guard.spec.ts` 1 suite / 8 tests 추가, contracts 총 23 tests).
- worker typecheck EXIT 0, worker test PASS(41→43 tests, stub 치환 2건 추가).
- db build PASS(value import 승격 정상 해결).
- 기존 worker/db/contracts 테스트 **무수정 통과** = valid 코드 동작 불변의 증거.
- `bash agents/harness/evals/checks.sh` 전체 게이트 = 커밋 전 최종 확인.
