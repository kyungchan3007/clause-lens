# PRD — packages/db 도메인 헬퍼 단일 소스화

> **이슈:** #141 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
분석 파이프라인의 **종결(terminal) 상태 판정**과 **Prisma 에러 코드 판별**이 api·worker·db 세 곳에 인라인으로 복붙되어 있다.

- **종결 상태 집합**: job 종결(`done·partial·failed`)·page 종결(`done·failed`) 문자열 비교가 산재.
  - `apps/worker/src/analysis.processor.ts`: `const TERMINAL = new Set(["done","partial","failed"])` + `TERMINAL.has(...)`, 페이지 루프 `pa.status === "done" || pa.status === "failed"`.
  - `apps/worker/src/lib/terminalize.ts`: job/page 종결을 동일 문자열로 인라인 판정.
  - `packages/db/src/analysis-ops.ts`: `confirmPageAnalysisTx`·`confirmAnalysisResultTx`의 멱등 가드가 job/page 종결을 각각 인라인 판정(4곳).
- **Prisma 에러 코드**: `P2002`(unique 위반)·`P2034`(직렬화 실패)가 인라인.
  - `apps/api/src/modules/documents/documents.service.ts`: 로컬 `isUniqueViolation`(P2002) 함수 중복 정의.
  - `packages/db/src/analysis-ops.ts`: `withSerializableRetry`의 `code === "P2034"`, `upsertPageOcr`의 `code === "P2002"` 인라인.

같은 값이 흩어져 있어 상태 집합·에러 코드를 바꾸려면 여러 파일을 동시에 손봐야 하고 drift(예: 한 곳만 `partial` 누락) 위험이 있다.

## 2. 목표 (Goals)
- G1. `packages/db`에 종결 상수·판정 단일화: `JOB_TERMINAL_STATUSES`·`PAGE_TERMINAL_STATUSES` + `isJobTerminal(s)`·`isPageTerminal(s)`.
- G2. `packages/db`에 Prisma 에러 판별 단일화: `isUniqueViolation(e)`(P2002)·`isSerializationFailure(e)`(P2034).
- G3. worker·api·db의 해당 인라인 판정을 모두 이 헬퍼로 교체(값·코드 완전 동일).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 상태 전이·동시성 재시도·멱등 동작 변경 — **동작 완전 불변**.
- N2. `reaggregateAndBump`의 done/failed **집계(tally)** 변경 — 종결 predicate가 아니라 개수 분기이므로 그대로 유지.
- N3. BullMQ job 상태(`main.ts`의 `"failed"/"missing"`) — 우리 도메인 상태가 아니라 BullMQ 상태이므로 범위 밖.
- N4. 종결 집합 값·에러 코드 자체 변경 — 값은 100% 보존.

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(내부 리팩토링). 분석 접수·진행·완료·부분실패·실패 전이, 재시도, 멱등 종결은 이전과 동일.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS(db·api·worker 빌드·타입·유닛 포함).
- 기존 worker/api 테스트가 **무수정 통과**(동작 불변의 증거).
- 종결 문자열 비교 인라인 8곳 → 헬퍼 호출, Prisma 코드 인라인 4곳 → 헬퍼 호출.

## 6. 제약 (Constraints)
서버가 진실의 기준(프론트는 표현만). `@clause-lens/db/analysis` 서브경로는 도메인 전이 계약만 노출(빌드 선행 필요). → [context/backend-architecture.md](../../context/backend-architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. 상태 문자열을 contracts의 유니온 타입과 엮어 컴파일타임 drift까지 차단할 수 있음 — 후속(#별도).

### Acceptance
- [x] `packages/db`: `JOB_TERMINAL_STATUSES`(done·partial·failed)·`PAGE_TERMINAL_STATUSES`(done·failed) + `isJobTerminal`·`isPageTerminal`.
- [x] `packages/db`: `isUniqueViolation`(P2002)·`isSerializationFailure`(P2034) (`withSerializableRetry` 근처).
- [x] `analysis.processor.ts` `TERMINAL`·페이지 종결 인라인 → `isJobTerminal`·`isPageTerminal`.
- [x] `terminalize.ts` job/page 종결 인라인 → 헬퍼.
- [x] `analysis-ops.ts` confirm 2함수의 job/page 종결 가드 4곳 → 헬퍼, `withSerializableRetry`·`upsertPageOcr`의 P2034·P2002 → 헬퍼.
- [x] `documents.service.ts` 로컬 `isUniqueViolation` 제거 → db에서 import.
- [x] 종결 집합 값·에러 코드(P2002·P2034) 완전 동일, 상태 전이·재시도 동작 불변.
- [x] 헬퍼 단위 테스트 추가.
- [x] 기존 테스트 무수정 통과.
- [x] `bash agents/harness/evals/checks.sh` PASS.
