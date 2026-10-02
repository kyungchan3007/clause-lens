# SDD — errorCode 영속/응답 경계 가드

> **관련 PRD:** 0055-worker-errorcode-guard/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"공개 계약 밖 코드는 경계에서 안전 코드로 치환한다"는 방어적 하드닝. 가드 함수를 계약의 단일 소스(`@clause-lens/contracts`)에 두고, errorCode가 흐르는 **두 경계**(worker 방출 지점·db 영속 지점)에 적용해 심층 방어(defense-in-depth)를 구성한다.

- **신규 `packages/contracts/src/analysis.ts`**
  - `isAnalysisErrorCode(code: unknown): code is AnalysisErrorCode` — 문자열 + `ANALYSIS_ERROR_CODES` 소속 판정.
  - `coerceAnalysisErrorCode(code: unknown, fallback: AnalysisErrorCode = "analysis_failed"): AnalysisErrorCode` — valid면 그대로, 아니면 fallback. 계약·타입과 동일 파일(값·타입 단일 소스).
- **영속 경계 — `packages/db/src/analysis-ops.ts` `confirmPageAnalysisTx`**
  - 동적으로 기록되는 유일한 지점(line 232: `errorCode: outcome.errorCode`)을 `coerceAnalysisErrorCode(outcome.errorCode)`로 감쌈.
  - 다른 errorCode 쓰기는 모두 리터럴 valid(`"stale_revision"`·`null`)이라 대상 아님. 이 경계가 **모든 호출자**(worker processor·terminalize·미래 호출자)를 덮는 최종 chokepoint.
  - `PageOutcome.errorCode`는 `string`으로 유지(호출부 호환) — 쓰기 직전에만 좁힘.
- **worker 경계 — `apps/worker/src/analysis.processor.ts`**
  - `FailDecision.errorCode` 타입을 `WorkerErrorCode` → `AnalysisErrorCode`로 좁혀 계약 밖 코드가 타입상 방출 불가.
  - `classify()`의 두 permanent 분기(`OcrPermanentError`·`AnalysisPermanentError`, `e.code`가 `WorkerErrorCode`)를 `coerceAnalysisErrorCode(e.code)`로 치환. 나머지 분기는 이미 리터럴 valid(`ocr_timeout`·`analysis_timeout`·`worker_failed`)거나 `ValidationError.code`(Extract로 valid)라 불변.
  - 미사용이 된 `WorkerErrorCode` import 제거.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 가드를 contracts에 두고 db 영속 경계 + worker 경계 둘 다 적용 | 단일 chokepoint(db)로 전 호출자 보장 + worker가 애초에 미방출(로그·메트릭도 깨끗), 치환 idempotent | 적용 2곳(소폭 중복) | ✅ |
| B. db 영속 경계에만 적용 | 최소 변경, 전 호출자 덮음 | worker 내부 로그/메트릭엔 여전히 계약 밖 코드가 흐름, `FailDecision` 타입이 넓게 남음 | ❌ |
| C. worker에만 적용 | worker 소유 경계 | terminalize·미래 db 호출자 미보호, 영속 chokepoint 부재 | ❌ |
| D. errorCode 컬럼을 DB enum으로 전환 | 스키마 수준 강제 | 마이그레이션·대규모 변경(PRD N2 위반), 롤백 비용↑ | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 신규: `packages/contracts/src/error-code-guard.spec.ts`.
- 수정: `packages/contracts/src/analysis.ts`(가드 2함수), `packages/db/src/analysis-ops.ts`(import + line 232 치환), `apps/worker/src/analysis.processor.ts`(import·FailDecision 타입·classify 2분기), `apps/worker/src/analysis.processor.spec.ts`(stub 치환 2테스트).
- 새 의존성: 없음(db는 이미 `@clause-lens/contracts` 의존, type import → value import로 승격). Expo 무관.
- 미변경: stub 어댑터, `WorkerErrorCode` 타입(errors.ts·ocr.port.ts), `analysis.mapper`, Prisma 스키마, terminalize(이미 valid `worker_failed`).

## 4. 데이터 / 계약 (Contracts)
`ANALYSIS_ERROR_CODES`·`PageAnalysis.errorCode` 컬럼 shape 불변. 가드는 **쓰는 값의 도메인을 계약 내부로 축소만** 함(확장 없음). **BFF 트리거 체크**: 해당 없음(새 API/외부 연동 아님).

## 5. 위험과 완화 (Risks)
- R1 valid 코드가 치환되면 동작 변경 → 완화: `coerceAnalysisErrorCode`는 `ANALYSIS_ERROR_CODES` 소속이면 **동일 값 반환**, 단위 테스트로 전 코드 passthrough 단언.
- R2 안전 기본값 선택이 과실패 유발 → 완화: 치환은 "계약 밖 코드가 들어온 비정상 경로"에서만 발생(정상 worker 분류는 valid 코드를 직접 지정). stub은 비프로덕션 전용이라 운영 영향 거의 없음.
- R3 db의 value import 승격으로 런타임 해결 실패 → 완화: contracts는 db의 기존 `dependencies`(workspace:*), 게이트가 contracts build 선행. typecheck·테스트로 확인.
- R4 `FailDecision` 타입 축소로 기존 분기 타입 에러 → 완화: ValidationError.code(Extract)·리터럴 분기는 AnalysisErrorCode에 할당 가능, permanent만 coerce. worker typecheck EXIT 0 확인.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 브랜치. 순수 내부 하드닝(동작 불변) → 문제 시 revert.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` PASS — contracts/db/infra build + worker·contracts typecheck·유닛 테스트.
- 신규 `error-code-guard.spec.ts`: 전 계약 코드 passthrough · `stub_disabled_in_production`→`analysis_failed` · 임의 문자열/빈 문자열→기본값 · 비문자열(undefined·null·number·object)→기본값 · fallback 인자 반영 · `isAnalysisErrorCode` 참/거짓.
- worker `analysis.processor.spec.ts` 신규 2건: stub OCR·stub 분석 영구 오류가 `confirmPageAnalysisTx`에 `errorCode: "analysis_failed"`로 전달됨(worker 경계 치환 증거).
- 기존 worker/db/contracts 테스트 무수정 통과 = valid 코드 동작 불변의 증거.
