# SDD — 계정 격리 스토어(accountScopedStore) 공통화

> **관련 PRD:** 0049-account-scoped-store/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"격리 공통 로직은 순수 함수 헬퍼로, 스토어 고유 로직은 feature에" 원칙. 두 스토어 모두 `generation: number` + `userId: string | null` 평평한 필드와 `set(patch)`를 가지므로, store의 get/set을 주입받는 **순수 함수**가 구조에 자연스럽게 맞는다(React/zustand 비의존 → 테스트 쉬움).

- **신규 `src/shared/model/accountScopedStore.ts`**
  - `AccountScopedState` — `{ generation: number; userId: string | null }` 최소 베이스 타입.
  - `syncAccount(get, set, userId, reset)` — `if (get().userId === userId) return;` 후 `set({ ...reset, generation: get().generation + 1, userId })`. 초기화 필드(`reset`)만 스토어가 주입(documents=items/nextCursor/loadingMore/refreshing/status, entitlement=data/staleError/pending/status). generation++·userId·early-return은 헬퍼가 소유.
  - `isStaleGeneration(get, gen): boolean` — `get().generation !== gen`. 캡처한 세대가 더 이상 최신이 아니면 true(= 응답 폐기). 호출부는 `if (isStaleGeneration(get, gen)) return;`, finally는 `if (!isStaleGeneration(get, gen)) set(...)`로 **1:1 치환**.
- **재배선 — documentsStore / entitlementStore**
  - `syncAccount` 메서드 본문을 공통 `syncAccount(get, set, userId, {초기화})` 호출로 교체(메서드명 충돌 피해 `syncAccountState`로 import 별칭).
  - refresh/loadMore의 `get().generation !== gen` → `isStaleGeneration(get, gen)`, `get().generation === gen` → `!isStaleGeneration(get, gen)` 로 치환. **set 호출·try/finally 구조·고유 로직(dedupe·pagination·inFlight/pending·staleError)은 그대로**.
- **신규 `src/shared/model/useAccountResourceSync.ts`** — `useAccountResourceSync(store, { refreshOnPhase })`
  - `store`는 사용하는 표면만 구조 타이핑: `{ getState: () => { syncAccount; refresh } }`(zustand UseBoundStore 변성 충돌 회피 — `getState()`만 호출).
  - effect1: authStore의 status·userId 구독 → authenticated면 `syncAccount(userId)+refresh`, unauthenticated면 `syncAccount(null)`(deps `[status, userId, store]`).
  - effect2: analysisStore.phase 구독 → `refreshOnPhase(phase)`면 refresh(deps `[phase, store, refreshOnPhase]`).
  - 소비 훅은 `refreshOnPhase`를 **모듈 레벨 상수**로 정의(안정 참조 → deps 추가해도 기존 `[status,userId]`/`[phase]` 트리거 타이밍 불변).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 순수 함수 `syncAccount`+`isStaleGeneration`(get/set 주입) | 두 스토어 구조에 맞음, 1:1 치환, 비동기/타이밍 불변, 테스트 쉬움 | reset은 파라미터로 받아야(완전 무인자 불가) | ✅ |
| B. `guardGeneration(get, gen, fn)` 래퍼(세대 맞을 때만 fn 실행) | 호출 1줄 | finally의 `===`/early-return·token-null 분기 구조를 바꿔 **타이밍/제어흐름 변형 위험**(불변 위반) | ❌ |
| C. zustand slice 믹스인으로 generation/userId 은닉 | 캡슐화 ↑ | 두 스토어 리팩토링 범위 큼·동작 보존 리스크 ↑(범위 초과) | ❌(후속) |
| D. 훅의 refreshOnPhase를 인라인 화살표로 전달 | 간단 | 매 렌더 새 참조 → effect2 deps 불안정 → 매 렌더 refresh(동작 변형) | ❌(모듈 상수로) |
| E. store를 `UseBoundStore<StoreApi<...>>`로 타이핑 | 정석 | setState/subscribe 변성 충돌로 타입 에러·불필요(가drState만 씀) | ❌(구조 타입) |

## 3. 영향받는 코드 (Touched Surface)
- 신규: `apps/mobile/src/shared/model/accountScopedStore.ts`(+`.test.ts`), `apps/mobile/src/shared/model/useAccountResourceSync.ts`(+`.test.ts`).
- 수정: `documentsStore.ts`·`entitlementStore.ts`(격리 로직 치환), `useDocumentsSync.ts`·`useEntitlementSync.ts`(공통 훅 소비).
- 새 의존성: 없음(순수 TS + 기존 react/zustand). Expo 무관.

## 4. 데이터 / 계약 (Contracts)
외부 API 계약 변화 없음. store 스키마 불변. **BFF 트리거 체크**: 해당 없음(새 API/외부 연동 아님).

## 5. 위험과 완화 (Risks)
- R1 generation 가드를 래퍼로 바꾸면 token-null 분기·finally의 `===` 판정 타이밍이 변함 → 완화: **predicate(`isStaleGeneration`)로 1:1 치환**, set/try/finally 구조 보존.
- R2 공통 훅의 deps에 store/refreshOnPhase 추가 시 참조 불안정 → 매 렌더 refresh → 완화: 소비 훅이 `refreshOnPhase`를 모듈 상수로, store는 모듈 싱글턴 → 참조 안정.
- R3 syncAccount 메서드명 ↔ 공통 함수명 충돌 → 완화: import 별칭(`syncAccountState`).
- R4 reset 필드 누락/추가로 격리 초기화가 달라짐 → 완화: 원본 set의 필드 목록을 그대로 reset으로 이관(inFlight 미리셋 등 원본과 동일).

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 브랜치. 순수 내부 재배선 → 문제 시 revert. 위험하면 일부(스토어만 or 훅만)만 공통화하고 나머지는 보고.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` PASS — mobile typecheck + 유닛 테스트(기존 documentsStore·entitlementStore 테스트가 동작 불변의 증거, before≈after).
- 신규 `accountScopedStore.test.ts`: syncAccount(동일 userId no-op·변경 시 gen++·초기화·null)·isStaleGeneration(세대 판정).
- 신규 `useAccountResourceSync.test.ts`: authenticated→syncAccount+refresh·unauthenticated→syncAccount(null)·restoring→무동작·phase 조건 트리거.
