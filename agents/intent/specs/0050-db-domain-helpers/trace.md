# 0050 — 과정 기록 (trace)

## 판단
- **동작 불변이 최우선.** 코드 변경 전 각 인라인 판정을 읽고 1:1 대조:
  - job 종결: worker `TERMINAL = new Set(["done","partial","failed"])` / db confirm 2함수의 `job.status === "done" || "partial" || "failed"` / terminalize의 동일 식 → **집합 값 완전 동일** 확인 후 `JOB_TERMINAL_STATUSES`+`isJobTerminal`로 치환.
  - page 종결: worker 페이지 루프·terminalize·db confirm 2함수의 `page.status === "done" || "failed"` → `PAGE_TERMINAL_STATUSES`+`isPageTerminal`(partial 미포함 = page는 partial 상태가 없음, done/failed만 종결).
  - 에러 코드: api `isUniqueViolation`(P2002)·db `withSerializableRetry`(P2034)·`upsertPageOcr`(P2002) → `isUniqueViolation`/`isSerializationFailure`로 치환. 코드 문자열 P2002·P2034 보존.
- **단일 소스 위치 = packages/db.** 종결 전이는 db의 `analysis-ops.ts`가 이미 소유(confirm 함수들)하고, worker·api가 이미 `@clause-lens/db/analysis`를 소비 중 → 새 의존성 0으로 db에 상수+헬퍼 추가가 적소. contracts(프론트 공유)는 종결 판정이 서버 전용이라 부적합.
- **집계(tally)는 손대지 않음.** `reaggregateAndBump`의 `done = pages.filter(p => p.status === "done")`·`failed = …"failed"`는 종결 여부 predicate가 아니라 job 상태 결정을 위한 **개수 분기**라 isPageTerminal로 통합하면 로직이 왜곡된다 → 원본 유지(불변 보수).
- **옵셔널 체이닝.** 새 `isUniqueViolation`/`isSerializationFailure`는 `(e as {code?})?.code === …`로 통일. 기존 db 인라인은 `?.` 없이 `(e as {code?}).code`였으나 catch된 e는 non-null이라 결과 불변(null-safe만 강화) — 테스트로 null·Error·타 코드 커버.

## 막힘 / 되돌림
- **worker 프로세서 스펙 실패 → 모킹 전략 수정.** `analysis.processor.spec.ts`가 `jest.mock("@clause-lens/db/analysis")`로 **모듈 전체 자동 모킹** → 새로 추가한 `isJobTerminal`/`isPageTerminal`까지 auto-mock(undefined 반환, falsy)되어 "완료 페이지 skip" 가드가 작동하지 않고 recognize가 호출됨(기존엔 `TERMINAL` Set이 프로세서 로컬이라 모킹 영향 없었음).
  - 되돌림: 모킹을 팩토리 형태로 바꿔 `...jest.requireActual(...)`로 순수 헬퍼는 **실제 구현 유지**하고 Tx 함수(`confirmAnalysisResultTx`·`confirmPageAnalysisTx`·`upsertPageOcr`)만 `jest.fn()` 모킹. 단일 소스 헬퍼를 테스트가 다시 복붙하지 않도록 requireActual 선택(값 drift 방지).
- **집계 통합 보류.** reaggregate의 done/failed 개수 분기를 isPageTerminal로 묶는 안을 검토했으나 개수가 따로 필요한 분기라 불변 위험 → 종결 가드(멱등 no-op)만 치환하고 집계는 유지.

## 검증 결과
- `bash agents/harness/evals/checks.sh` **ALL PASS**(전체 게이트: contracts/db/infra 빌드 + mobile·api·worker·ui 타입 + 유닛 + expo-doctor + 기록 검사).
- worker 유닛: before **5 suites / 35 tests** → after **6 suites / 41 tests**(신규 `db-helpers.spec.ts` 1 suite / 6 tests 추가, 기존 `analysis.processor.spec.ts` 등 무수정 통과 = 종결 판정·재시도 동작 불변의 증거).
- api·mobile·ui·contracts·infra 유닛 모두 무수정 통과.
- 중복 제거: ① job 종결 인라인 4곳(worker Set+has 2 표현, db 2) → `isJobTerminal` ② page 종결 인라인 4곳(worker 1, terminalize 1, db 2) → `isPageTerminal` ③ P2002 인라인 2곳(api, db upsert) → `isUniqueViolation` ④ P2034 인라인 1곳(db retry) → `isSerializationFailure`. api 로컬 `isUniqueViolation` 함수 정의 제거(db import로 대체).
- LOC(4개 파일 합): before 839 → after 857(순 +18). 리팩토링 목적이 **단일 소스화**라 raw LOC는 소폭 증가가 정상: db `analysis-ops.ts` +19(헬퍼 8개 정의+doc 주석), terminalize +4(import 확장), documents.service −5(로컬 함수 제거), processor ±0. 인라인 판정 11곳·로컬 함수 1개를 명명된 단일 소스로 대체 → 중복/drift 제거가 성과(라인 수 감소가 아님).
