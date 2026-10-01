# SDD — packages/db 도메인 헬퍼 단일 소스화

> **관련 PRD:** 0050-db-domain-helpers/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"도메인 상태·에러 판정은 `packages/db`(상태 전이 계약의 소유자)에 단일 소스로, 소비처는 호출만" 원칙. 종결 집합과 Prisma 코드는 이미 db의 `analysis-ops.ts`가 사실상 기준점(상태 전이가 여기 모임)이므로, 같은 파일에 상수+순수 판정 함수를 추가하고 `@clause-lens/db/analysis`로 노출한다. worker·api는 이미 이 서브경로를 소비 중이라 새 의존성이 없다.

- **종결 상수·판정** — `analysis-ops.ts` 상단(큐 이름 근처, 전이 함수들보다 앞):
  - `JOB_TERMINAL_STATUSES = ["done","partial","failed"] as const` · `PAGE_TERMINAL_STATUSES = ["done","failed"] as const`.
  - `isJobTerminal(s: string)` = `(JOB_TERMINAL_STATUSES as readonly string[]).includes(s)` · `isPageTerminal(s)` 동형.
  - `as const` + `includes`로 **값은 한 곳에서만** 정의. 리터럴 배열을 `readonly string[]`로 넓혀 임의 문자열 인자 허용(호출부가 `job.status: string`).
- **Prisma 에러 판별** — `withSerializableRetry` 바로 앞:
  - `isUniqueViolation(e)` = `(e as {code?:string})?.code === "P2002"` · `isSerializationFailure(e)` = `… === "P2034"`.
  - 기존 인라인(`const code = (e as {code?}).code; if (code === "P2034" …)` / `(e as {code?}).code === "P2002"`)과 **옵셔널 체이닝 포함 의미 동일**(인라인은 `?.` 없었으나 e는 catch된 non-null이라 동작 불변, null-safe만 강화).
- **1:1 치환(소비처)**:
  - db `analysis-ops.ts`: job 가드 2곳·page 가드 2곳 → `isJobTerminal`/`isPageTerminal`, retry `P2034`·upsert `P2002` → 판별 함수. **reaggregate의 done/failed 집계는 그대로**(종결 개수 분기이지 predicate 아님).
  - worker `analysis.processor.ts`: `TERMINAL` Set 삭제 + `isJobTerminal(status)`, 페이지 루프 `isPageTerminal(pa.status)`.
  - worker `terminalize.ts`: job/page 종결 가드 → 헬퍼.
  - api `documents.service.ts`: 로컬 `isUniqueViolation` 삭제 + `@clause-lens/db/analysis`에서 import(호출부 `if (isUniqueViolation(e))` 불변).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. db에 상수+순수 판정 함수, 소비처는 호출 | db가 상태 전이 소유자라 자연스러움, 새 의존성 0, 1:1 치환 | 없음(최소 변경) | ✅ |
| B. contracts에 상태 유니온+헬퍼 배치 | 프론트까지 공유 | 종결 판정은 서버 전용 도메인, worker/api만 소비 → db가 적소 | ❌ |
| C. reaggregate done/failed 집계도 isPageTerminal로 통합 | 중복 제거 폭↑ | done·failed **개수**를 따로 써야 하는 분기(종결 여부 아님) → 통합 시 로직 왜곡·불변 위험 | ❌ |
| D. 에러 판별을 Prisma.PrismaClientKnownRequestError instanceof로 | 타입 안전 | 기존 인라인은 duck-typing(`.code`)이라 동작·테스트 더블 호환 깨질 위험 | ❌(코드 비교 유지) |
| E. `TERMINAL` Set 유지하고 db만 공통화 | 변경 최소 | worker 쪽 drift 소스 잔존(이슈 목적 미달) | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 수정: `packages/db/src/analysis-ops.ts`(상수·헬퍼 6개 추가 + 인라인 6곳 치환), `apps/worker/src/analysis.processor.ts`, `apps/worker/src/lib/terminalize.ts`, `apps/api/src/modules/documents/documents.service.ts`.
- 신규: `apps/worker/src/lib/db-helpers.spec.ts`(헬퍼 단위 테스트 — 게이트가 실행하는 worker jest 스위트에서 `@clause-lens/db/analysis` 공개 export 검증).
- 새 의존성: 없음. Prisma/Expo 무관.

## 4. 데이터 / 계약 (Contracts)
외부 API 계약·DB 스키마 변화 없음. 종결 집합 값·에러 코드는 보존. **BFF 트리거 체크**: 해당 없음.

## 5. 위험과 완화 (Risks)
- R1 종결 집합에서 상태 하나 누락/추가 시 전이 왜곡 → 완화: `as const` 배열을 원본 Set/인라인과 1:1 대조, 단위 테스트로 값 고정(`toEqual`).
- R2 옵셔널 체이닝 추가로 의미 변화 → 완화: catch된 e는 non-null, `?.`는 null-safe 강화일 뿐 P2002/P2034 판정 결과 불변(테스트로 null·Error·타 코드 커버).
- R3 reaggregate 집계를 건드려 job 상태 결정이 바뀜 → 완화: **집계 미변경**(done/failed 개수 분기 그대로).
- R4 헬퍼가 미빌드 상태로 worker 테스트가 import 실패 → 완화: 게이트가 Build(db)를 worker 테스트보다 먼저 실행(checks.sh 순서).

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 브랜치. 순수 내부 재배선 → 문제 시 revert. 값 불변이라 블루그린 불필요.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` PASS — Build(contracts→db→infra) → mobile/api/worker/ui 타입 → 유닛(api·worker 기존 테스트가 동작 불변의 증거) → expo-doctor → 기록 검사.
- 신규 `db-helpers.spec.ts`: 종결 집합 값 고정(`toEqual`)·`isJobTerminal`/`isPageTerminal` 경계(partial은 page 비종결)·`isUniqueViolation`/`isSerializationFailure`(P2002·P2034만 true, null·Error·타 코드 false).
- 기존 `analysis.processor.spec.ts` 등 worker 테스트 무수정 통과 = 종결 판정·재시도 동작 불변.
