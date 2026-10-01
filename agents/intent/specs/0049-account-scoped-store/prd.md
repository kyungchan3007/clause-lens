# PRD — 계정 격리 스토어(accountScopedStore) 공통화

> **이슈:** #139 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
`apps/mobile`의 `documentsStore`·`entitlementStore` 두 상태 스토어가 **계정 격리(account isolation)** 로직을 각자 복붙하고 있고, `useDocumentsSync`·`useEntitlementSync` 두 훅도 **인증·분석 phase → 재조회** 배선을 복붙하고 있다.

- `syncAccount(userId)`: 두 스토어 모두 `if (get().userId === userId) return; set({ generation: get().generation + 1, userId, ...초기화 })`로 **동일 구조**(초기화 필드만 스토어별로 다름).
- generation 가드: `const gen = get().generation` 캡처 후 매 await 뒤 `if (get().generation !== gen) return`(폐기), finally는 `if (get().generation === gen) set(...)` — 두 스토어 refresh/loadMore에 **총 10여 곳** 흩어짐.
- sync 훅: `authStore 구독 → authenticated면 syncAccount(userId)+refresh / unauthenticated면 syncAccount(null)`, `analysisStore.phase 변화 시 refresh` — **phase 조건만** 다르고 나머지는 동일.

같은 패턴이 흩어져 있어 격리 방식을 바꾸려면 두 스토어·두 훅을 동시에 손봐야 하고 drift 위험이 있다. 단, 각 스토어의 고유 로직(entitlement의 inFlight/pending 겹침 처리, documents의 dedupe/pagination)은 서로 다르다.

## 2. 목표 (Goals)
- G1. 공통 `src/shared/model/accountScopedStore.ts`: `syncAccount(get, set, userId, reset)`(동일 userId no-op·generation++·userId·초기화) + `isStaleGeneration(get, gen)`(폐기 판정) 단일화. 두 스토어가 소비.
- G2. 공통 `src/shared/model/useAccountResourceSync.ts(store, { refreshOnPhase })`: 인증 구독 + phase 재조회 배선 단일화. **phase 조건만 파라미터화**. 두 훅이 소비.
- G3. entitlement inFlight/pending, documents dedupe/pagination은 각 스토어에 그대로 유지(공통화 대상 아님).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 외부 동작(generation 증가 시점·폐기 판정·refresh 트리거 phase 조건·겹친 refresh 1회 더·목록 깜빡임 방지) 변경 — **동작 완전 불변**.
- N2. 겹친 refresh(inFlight/pending)·pagination(loadMore/dedupe)·removeDocument·staleError 표시 정책 변경 — 스토어 고유, 그대로.
- N3. store 스키마(generation/userId/상태 필드) 변경 — 그대로.
- N4. 레이어 경계(shared↔feature) 재설계 — 기존 훅이 이미 auth·analysis를 참조, 배선 위치만 유지.

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(내부 리팩토링). 로그인·계정 변경·로그아웃·분석 완료 시 재열람 목록·무료 잔량 갱신 동작은 이전과 동일.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS(mobile 타입·유닛 테스트 포함, before≈after).
- 기존 `documentsStore`/`entitlementStore` 테스트가 **무수정 통과**(동작 불변의 증거).
- `syncAccount` 중복 구현 2→1, generation 가드 표현 단일화.

## 6. 제약 (Constraints)
Expo v57, 서버가 진실의 기준(프론트는 표현만). → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. 장기적으로 zustand slice 믹스인으로 승격해 generation/userId 필드 노출 자체를 감출 수 있음 — 후속(#별도).

### Acceptance
- [x] `src/shared/model/accountScopedStore.ts` 신설: `syncAccount(get, set, userId, reset)` + `isStaleGeneration(get, gen)`.
- [x] `documentsStore`·`entitlementStore`가 `syncAccount`·`isStaleGeneration` 소비(중복 격리 로직 제거).
- [x] `src/shared/model/useAccountResourceSync.ts` 신설: 인증 구독 + phase 재조회, `refreshOnPhase`만 파라미터화.
- [x] `useDocumentsSync`·`useEntitlementSync`가 공통 훅 소비(phase 조건만 주입).
- [x] entitlement inFlight/pending·documents dedupe/pagination은 각 스토어 유지.
- [x] generation 증가 시점·폐기 판정·refresh phase 조건·겹친 refresh 1회 더 완전 동일.
- [x] 공통 모듈 단위 테스트 추가(accountScopedStore·useAccountResourceSync).
- [x] 기존 documentsStore/entitlementStore 테스트 무수정 통과.
- [x] `bash agents/harness/evals/checks.sh` PASS.
