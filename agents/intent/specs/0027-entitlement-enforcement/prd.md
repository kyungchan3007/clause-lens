# 0027 — 무료 분석 횟수 서버 집행 — PRD

> **이슈:** #90 · **관련 태스크**: #90 (task, TASK-005) · **상태**: in-progress · **유형**: 기능 (Auth & Entitlement)

## 1. 문제
무료 분석 횟수 **차감 정책은 확정**됐지만(#79 — `done`만 1회 차감·`partial`/`failed`/`invalid_image` 무차감·멱등키 `AnalysisJob.id`·사용자당 3회), 서버는 아직 집행하지 않는다. [analysis-ops.ts](../../../../packages/db/src/analysis-ops.ts) `reaggregateAndBump`에는 "무료횟수 차감 훅 지점" 주석만 있다. 집행이 없으면 한도가 무의미하고, 동시 접수로 한도를 넘길 수 있다.

## 2. 목표
- G1. **한도 집행**: 가용 무료 횟수가 없으면 분석 접수를 거부한다(서버가 최종 판단, 앱은 표시만).
- G2. **원자적 예약**: 접수(새 job 생성) 시 1회를 원자적으로 예약해, 동시 접수가 한도를 초과하지 못하게 한다.
- G3. **확정 차감 / 해제**: terminal 전이와 **같은 트랜잭션**에서 `done`→확정 차감(consume), 그 외 종결(`partial`·`failed`·`stale`·`worker_failed`)→예약 해제(release).
- G4. **멱등**: 멱등키 `AnalysisJob.id`. 재연결·재시도·중복 완료 이벤트에도 job당 **최대 1회** 차감.
- G5. **잔량 조회**: 현재 잔량을 반환하는 엔드포인트(서버 값).

## 3. 목표가 아닌 것 (Non-goals)
- N1. **앱 잔량 표시·권한부족 흐름(UI)** — 별도 이슈(이 이슈에 의존).
- N2. **구독 우회** — 구독 모델은 TASK-006. 지금은 무료 횟수만. 구독자 무제한은 후속에서 집행 지점에 추가.
- N3. **무료 횟수 충전·관리자 조정** — 지금은 고정 부여(3). 변경은 후속.
- N4. **재분석 과금** — 재분석은 비목표(startAnalysis가 terminal 포함 기존 job 반환) → 새 차감 없음.

## 4. 제약 (Constraints)
- "서버가 진실의 기준" — 앱은 차감을 판단하지 않는다. base=develop.
- 차감은 terminal 확정 시점(접수 시 아님). 예약은 접수 시(한도 집행용), 확정/해제는 terminal.
- 전이·차감은 한 트랜잭션(부분 반영 금지). 멱등은 `EntitlementCharge.jobId` 원장으로.

## Acceptance
- [x] 분석 접수 시 가용 무료 횟수가 없으면 거부된다(권한 안내 가능한 응답). (`reserveFreeAnalysis` false → `QuotaExceededError` → `ForbiddenException`(403) · 테스트: service 403 · reserve 거부)
- [x] 접수 시 원자적으로 1회 예약되어 동시 접수가 한도를 초과하지 않는다. (조건부 단일 `$executeRaw` UPDATE·job 생성 tx 안 · 테스트: 가용 1에서 2건 중 1건만 성공. 실 Postgres 동시성 실측은 후속)
- [x] 분석이 `done`으로 종결되면 정확히 1회 확정 차감된다(멱등키 AnalysisJob.id → 최대 1회). (`settleFreeAnalysis(done)` consume·`reaggregateAndBump` 같은 tx · 테스트: done→consumed·중복 done no-op)
- [x] `partial`·`failed`·`stale`·`worker_failed` 종결이면 예약이 해제되고 차감되지 않는다. (非done=release · stale/worker_failed도 `confirmPageAnalysisTx`→reaggregate 해제 경로 · 테스트: partial·failed→released)
- [x] 재연결·중복 완료 이벤트에도 차감/해제가 중복되지 않는다. (`EntitlementCharge.status==reserved` 가드 · 테스트: 두 번째 정산 no-op·예약 없는 job no-op)
- [x] 현재 잔량 조회 엔드포인트가 서버 값을 반환한다. (`GET /me/entitlement` → `getEntitlement`(없으면 기본 부여) · 테스트: 신규 3·잔량 계산·0 하한)
- [x] 단위 테스트가 예약·확정·해제·멱등·동시성 경계를 덮는다. (`entitlement-ops.spec.ts` 13케이스 — api 유닛 PASS)
