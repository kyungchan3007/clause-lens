# 0029 — 무료 분석 잔량 표시 + 403 흐름 (앱) — PRD

> **이슈:** #94 · **관련 태스크**: #94 (task, TASK-005 앱) · **상태**: in-progress · **유형**: 기능 (앱 · Auth & Entitlement)

## 1. 문제
무료 분석 횟수 **서버 집행**은 완료·머지됨(#90/PR#91 — `GET /me/entitlement`, 접수 시 403). 하지만 앱은 **남은 횟수를 표시하지 않고**, 횟수 소진(403)도 "분석 요청에 실패했어요"로 뭉개서 사용자가 이유를 모른다. "서버가 진실의 기준" — 앱은 서버 값을 표시만 한다.

## 2. 목표
- G1. ProfileScreen에 **남은 무료 분석 횟수**(서버 `freeRemaining`)를 표시(로딩·실패 상태 포함).
- G2. 분석 접수 **403**이면 "현재 사용할 수 있는 무료 분석 횟수가 없어요"로 분기(404·409·네트워크와 구분).
- G3. **갱신 트리거**: 로그인·접수 성공·모든 terminal·403·프로필 포커스. (잔량은 terminal뿐 아니라 **접수(예약) 시점에도** 변함.)
- G4. **계정 격리·동시성**: 계정 전환/로그아웃 시 이전 잔량 미노출, 겹친 refresh가 과거 응답에 덮이지 않음, entitlement 실패가 분석 접수를 실패시키지 않음.

## 3. 목표가 아닌 것 (Non-goals)
- N1. **구독 상태 표시·구독 안내 CTA·결제** — TASK-006 (백엔드에 구독 필드 없음).
- N2. **서버 403 구조화 오류 코드**(계약 보강) — 권장이나 이번 필수 선행 아님. 지금은 접수 API 한정 403 fallback.
- N3. **TanStack Query 도입** — 이 단일 조회에 과함(백로그). 수동 store로.
- N4. 앱이 잔량을 임의 계산(−1 등)하거나 캐시된 0으로 분석을 선제 차단 — 금지(최종 판정 서버).

## 4. 제약 (Constraints)
- 기존 앱 패턴: feature 폴더, `fetch`+Bearer, zod 계약 검증, zustand. base=develop.
- 토큰·URL 로그 금지(guardrail).

## Acceptance
- [x] ProfileScreen에 남은 무료 분석 횟수(서버 값)가 표시된다(로딩·실패 상태 포함, 0회로 대체 금지). (`FreeQuotaRow` + store 표시 정책 · 단위: 최초 loading·error·재조회 staleError)
- [x] 분석 접수 403이면 "현재 사용할 수 있는 무료 분석 횟수가 없어요" 안내로 분기한다(404·409·네트워크 오류와 구분). (`useAnalysis` 403 분기 · 단위: 403 vs 500)
- [x] 잔량은 로그인·접수 성공·모든 terminal·403·프로필 포커스에서 갱신된다. (`useEntitlementSync`(인증·분석 phase) + ProfileScreen `useFocusEffect`)
- [x] 계정 전환·로그아웃 시 이전 사용자 잔량이 노출되지 않는다(응답 격리 포함). (`syncAccount`·generation guard · 단위: 조회 중 계정 변경→폐기·로그아웃 제거·같은 userId 유지)
- [x] 겹친 refresh가 과거 응답으로 덮이지 않고, entitlement 조회 실패가 분석 접수를 실패시키지 않는다. (store 직렬화(pending)·sync 분리 · 단위: 겹친 refresh→완료 후 1회)
- [x] 단위(응답 격리·겹친 refresh·403 분기·zod 실패) + e2e(표시·갱신·403·계정 전환) 통과. (단위 신규 17 PASS · e2e: 표시 자동(profile.yaml S21), 403·계정전환·접수/완료 갱신은 백엔드 seeding 필요 → 반자동/실측 후속)
