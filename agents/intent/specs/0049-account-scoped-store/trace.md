# 0049 — 과정 기록 (trace)

## 판단
- **동작 불변이 최우선.** 코드 변경 전 두 스토어·두 훅의 격리/배선 로직을 1:1 대조:
  - `syncAccount`: 두 스토어 모두 `if (get().userId === userId) return; set({ generation: get().generation + 1, userId, ...초기화 })`로 동일. 초기화 필드만 다름(documents=items/nextCursor/loadingMore/refreshing/status, entitlement=data/staleError/pending/status) → 초기화를 `reset` 파라미터로 받는 `syncAccount(get, set, userId, reset)`로 단일화.
  - generation 가드: 두 스토어 refresh/loadMore가 `const gen = get().generation` 캡처 후 매 await 뒤 `get().generation !== gen`(폐기), finally `get().generation === gen`(반영) → `isStaleGeneration(get, gen)` predicate로 1:1 치환(제어흐름·set 구조 보존).
- **guardGeneration 래퍼 대신 predicate 선택.** 처음엔 `guardGeneration(get, gen, fn)`(세대 맞을 때만 fn) 형태를 검토했으나, 원본은 ① await 뒤 early-return, ② token-null 조기 분기, ③ finally의 `=== gen` 조건부 set 등 제어흐름이 섞여 있어 래퍼로 감싸면 타이밍/구조가 바뀐다(불변 위반). → 순수 predicate `isStaleGeneration`으로 치환만.
- **스토어 고유 로직은 건드리지 않음.** entitlement의 inFlight/pending(겹친 refresh 1회 더)·staleError 표시 정책, documents의 dedupe·loadMore pagination·removeDocument는 공통화 대상에서 제외하고 그대로 유지.
- **공통 훅 deps 안정화.** `useAccountResourceSync`가 `store`·`refreshOnPhase`를 인자로 받으면서 effect deps에 들어가는데, 소비 훅이 `refreshOnPhase`를 인라인 화살표로 넘기면 매 렌더 새 참조 → effect2가 매 렌더 refresh(동작 변형). → 소비 훅에서 `refreshOnPhase`를 모듈 레벨 상수로 정의해 참조 안정화(store는 모듈 싱글턴). 결과적으로 effect1은 status/userId 변화에만, effect2는 phase 변화에만 트리거 → 원본 `[status,userId]`/`[phase]`와 동일.
- **store 타입은 구조 타이핑.** `useAccountResourceSync`는 `store.getState()`만 호출 → `UseBoundStore<StoreApi<...>>`로 받으면 setState/subscribe 변성 충돌. 사용 표면만 `{ getState: () => { syncAccount; refresh } }`로 타이핑해 두 스토어가 구조적으로 만족.
- **메서드명 충돌 회피.** 스토어의 `syncAccount` 메서드 본문에서 공통 `syncAccount`를 호출하므로 import를 `syncAccountState` 별칭으로.

## 막힘 / 되돌림
- **guardGeneration(get, gen, fn) 래퍼 보류.** 이슈 제안의 `guardGeneration(get, gen, fn)` 형태를 먼저 검토했으나, 원본 refresh/loadMore가 await 뒤 early-return·token-null 조기 분기·finally의 `=== gen` 조건부 set을 섞어 쓰는 제어흐름이라 래퍼로 감싸면 구조가 바뀐다 → 순수 predicate `isStaleGeneration`으로 되돌려 1:1 치환만.
- **스토어 refresh 본문 통합은 보류(보수적 범위).** entitlement의 inFlight/pending(겹침)·staleError와 documents의 refreshing/dedupe/pagination은 조건·타이밍이 서로 달라 억지로 공통화하면 불변 위험 → 각 스토어 유지. 공통화는 격리(syncAccount·generation 가드)와 sync 훅 배선에 한정.
- **훅 deps 안정화.** 공통 훅이 store·refreshOnPhase를 인자로 받으며 effect deps에 포함 → 인라인 화살표면 매 렌더 refresh 위험. 소비 훅에서 refreshOnPhase를 모듈 상수로 올려 참조 안정화(검증: useAccountResourceSync.test의 phase 테스트가 조건별 1회 호출 확인).

## 검증 결과
- `bash agents/harness/evals/checks.sh` **ALL PASS**(전체 게이트: contracts/db/infra 빌드 + mobile·api·worker·ui 타입 + 유닛 + expo-doctor + 기록 검사).
- 기존 `documentsStore`(9 tests)·`entitlementStore`(9 tests) 테스트가 **수정 없이 통과** = 동작 불변의 증거(generation 증가·폐기 판정·겹친 refresh 1회 더·목록 격리 동일).
- 신규 테스트 2 suite: `accountScopedStore.test.ts`(7) + `useAccountResourceSync.test.ts`(5) = 12 tests 추가.
- mobile 테스트 before 35 suites/215 → after **37 suites/227**. before≈after(신규 공통 모듈 테스트만 증가).
- 중복 제거: ① `syncAccount` 격리 블록 2→1(공통 함수) ② generation 가드 인라인 10곳 → 공통 `isStaleGeneration` ③ sync 훅 인증+phase 배선 2벌 → 공통 `useAccountResourceSync`. 두 sync 훅 LOC 61→24.
