# 0046 — 과정 기록 (trace)

## 판단
- **값 완전 대조 먼저.** 코드 변경 전에 worker 중복 정의와 contracts를 1:1 대조해 값이 동일함을 확인(불변 보장이 최우선).
  - 조항타입 9종: `auto_renewal·penalty·termination_restriction·liability·unilateral_change·auto_payment·privacy_broad·jurisdiction·other` — worker `CLAUSE_TYPES` == contracts `clauseTypeSchema`. **동일**.
  - 위험도 3종: `high·medium·low` — worker(extraction-schema·port)·db(`ClauseRisk`) == contracts `clauseRiskLevelSchema`. **동일**.
  - 에러코드: worker에서 쓰는 `invalid_image·image_too_large·ocr_timeout·ocr_failed·analysis_timeout·analysis_failed·worker_failed` 모두 contracts `ANALYSIS_ERROR_CODES`에 존재. **동일**.
- **worker 전용 코드 발견**: `stub_disabled_in_production`(stub-ocr·stub-clause-analyzer 어댑터). contracts에 없음. 이것은 개발·스텁 전용 비상 코드로, 공개 계약 enum에 넣으면 앱·API에 노출되는 계약 변경이 된다 → **승격하지 않고** worker 전용 `WorkerErrorCode = AnalysisErrorCode | "stub_disabled_in_production"`로 보존(값 불변).
- **contracts에 `CLAUSE_TYPES` 배열 추가**: contracts는 `clauseTypeSchema`만 있고 배열 상수는 worker에만 있었다. zod `z.enum`에 넣을 튜플이 필요하므로 contracts에서 배열을 single source로 export하고 `clauseTypeSchema = z.enum(CLAUSE_TYPES)`로 재구성(값 동일, 순서 동일).
- **에러코드 통일 방식**: 단순 `string` 유지(import만)로는 drift 차단이 안 된다. `FailDecision.errorCode`와 각 에러 클래스 `code`를 contracts 기반 타입으로 걸어, 리터럴이 contracts 집합을 벗어나면 컴파일 에러가 나게 함(실질 통일).
- **db 통일 포함**: `Box`·`ClauseRisk`가 contracts와 구조 동일하고 checks.sh가 contracts→db 순으로 빌드하므로, db가 contracts를 참조(재노출)하도록 통일. 소비자(api·worker)는 구조 동일이라 무변.

## 막힘 / 되돌림
- (기록 강제 훅) 코드 수정 전 spec 폴더(prd/sdd/trace) 선행 필요 → 0046 폴더부터 작성 후 코드 착수.
- worker 타입체크가 `@clause-lens/infra` 미빌드로 실패 → 내 변경과 무관(기존 선행 빌드 의존). checks.sh가 infra도 빌드하므로 게이트에선 해결. 로컬 선검증 때 infra를 먼저 빌드.
- db가 `@clause-lens/contracts`를 참조하도록 의존성 추가 후 `pnpm install` → db `.d.ts`가 contracts 타입을 가리키는데, checks.sh의 `Build (contracts)`→`Build (db)` 순서로 타입 해석 보장됨(새 실패 없음).

## 검증 결과
- 값 대조(HEAD diff): 조항타입 9종·위험도 3종·에러코드(invalid_image·image_too_large·analysis_failed·analysis_timeout·ocr_* 등) 문자열 **완전 동일**. 값 변경 0.
- `bash agents/harness/evals/checks.sh` **ALL PASS**(20개 체크). worker 유닛 35개 통과(before=after=35, 값 불변 입증).
- 통일한 중복: 조항타입·위험도 유니온·에러코드·Box 4종을 contracts 단일 소스로. `stub_disabled_in_production`은 worker 전용 `WorkerErrorCode`로 값 보존(계약 미오염).
