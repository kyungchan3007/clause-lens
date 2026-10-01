# 0046 — worker contracts 타입 통일 — SDD

> **관련 PRD:** 0046-worker-contracts-types/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"값은 그대로, 출처만 contracts로" 원칙의 재배선(rewire). 런타임 리터럴을 contracts의 스키마/타입 import로 치환하되, 각 리터럴이 contracts 집합에 속하는지 **컴파일타임에 강제**되게 타입을 건다.

- **contracts(`analysis.ts`)**: `clauseTypeSchema`를 리터럴 배열 기반으로 재구성해 `CLAUSE_TYPES` 상수를 export(값 동일: `z.enum(CLAUSE_TYPES)`). worker가 `z.enum`에 넣을 튜플을 재사용할 수 있게 함. 위험도는 기존 `clauseRiskLevelSchema`/`ClauseRiskLevel`을 그대로 사용.
- **worker `extraction-schema.ts`**: 로컬 `CLAUSE_TYPES`·`z.enum(["high","medium","low"])` 제거 → `clauseTypeSchema`·`clauseRiskLevelSchema`를 직접 사용(zod 스키마 재사용). 값 집합 불변.
- **worker `clause-analyzer.port.ts`**: `riskLevel: "high"|"medium"|"low"` → `ClauseRiskLevel`(contracts).
- **에러코드 통일**: worker 전용 코드(`stub_disabled_in_production`)가 스텁 어댑터에서 실제로 쓰이므로, `errors.ts`에 `WorkerErrorCode = AnalysisErrorCode | "stub_disabled_in_production"`를 정의. 각 에러 클래스의 `code`를 contracts 기반 타입으로 바꿈(ValidationError는 의미상 2종으로 `Extract`). `ocr.port.ts`의 OCR 에러 클래스도 동일 적용. `analysis.processor.ts`의 `FailDecision.errorCode`를 `WorkerErrorCode`로 타이핑 → classify의 리터럴이 contracts 집합 밖이면 타입 에러.
- **db 단일화**: `packages/db`에 `@clause-lens/contracts` 의존 추가, `analysis-ops.ts`의 `Box`·`ClauseRisk`를 contracts `Box`·`ClauseRiskLevel` 재노출/별칭으로 교체(구조 동일 → 소비자 무변). checks.sh가 contracts→db 순으로 빌드하므로 타입 해석 순서 보장.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 리터럴을 contracts 스키마/타입으로 재배선, worker 전용 코드만 `WorkerErrorCode`로 보존 | 값 불변 보장, drift를 컴파일타임에 차단, 범위 최소 | 에러코드 타입 설계 약간 필요 | ✅ |
| B. `stub_disabled_in_production`를 contracts `ANALYSIS_ERROR_CODES`에 추가해 전부 `AnalysisErrorCode`로 통일 | 타입 단일 | **공개 계약 enum 오염**(앱·API 노출), 값 추가 = 계약 변경(불변 위반) | ❌ |
| C. 에러코드를 `string`으로 둔 채 import만 추가 | 변경 최소 | drift 차단 안 됨(리팩토링 목적 미달), 사실상 통일 아님 | ❌ |
| D. db `Box`/위험도는 그대로 두고 worker만 통일 | db 미변경, 안전 | Box·위험도 중복 잔존(단일 소스 목표 미달) | ❌(구조 동일·빌드 순서 보장되어 통일 채택) |

## 3. 영향받는 코드 (Touched Surface)
- 수정: `packages/contracts/src/analysis.ts`(CLAUSE_TYPES export), `apps/worker/src/lib/extraction-schema.ts`·`lib/errors.ts`·`ports/clause-analyzer.port.ts`·`ports/ocr.port.ts`·`analysis.processor.ts`, `apps/worker/package.json`, `packages/db/src/analysis-ops.ts`·`documents-ops.ts`·`package.json`.
- 새 의존성: `apps/worker`·`packages/db`에 `@clause-lens/contracts: workspace:*`(이미 레포 내 패키지 — Expo 무관, 서버 측).
- 상태: 서버 기준 enum(조항타입·위험도·에러코드) 소스 = contracts.

## 4. 데이터 / 계약 (Contracts)
외부 API 계약 shape 변화 없음. 조항타입 9종·위험도 3종·에러코드 11종의 **문자열 값 완전 동일**(대조표는 trace.md). worker 전용 `stub_disabled_in_production`은 계약 밖 유지. **BFF 트리거 체크**: 해당 없음(새 외부 연동 아님).

## 5. 위험과 완화 (Risks)
- R1 값(철자/대소문자)이 바뀌면 분석 분류·DB enum 저장 깨짐 → 완화: 기존 리터럴을 그대로 contracts 집합과 1:1 대조(trace 대조표), zod 스키마 재사용으로 값 재입력 자체를 제거.
- R2 db가 contracts dist를 못 찾아 빌드 실패 → 완화: checks.sh의 `Build (contracts)` → `Build (db)` 순서 활용, db에 의존성 명시.
- R3 worker 전용 코드 누락으로 타입 에러 → 완화: `WorkerErrorCode`로 `stub_disabled_in_production` 보존, 스텁 어댑터 2곳 유지.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 브랜치. 순수 타입 소스 변경이라 데이터·마이그레이션 영향 없음 → 문제 시 revert.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` PASS — contracts·db·worker 빌드/타입체크, worker·api·mobile 유닛 테스트(값 불변이라 기존 테스트 그대로 통과).
- 수동: 조항타입·위험도·에러코드 문자열을 contracts와 diff 대조(trace 대조표), 중복 정의 제거 확인.
