# PRD — 실행 세대(runGuard) 공통화

> **이슈:** #136 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
`apps/mobile`의 `useUpload`·`useAnalysis` 두 비동기 훅이 **stale-run 가드**(실행 세대 무효화) 로직을 각자 복붙하고 있다.

- `function alive(runId): boolean { return useXStore.getState().runId === runId; }` 가 **두 파일에 동일 구현**으로 2중복.
- 세대 증가(`store.runId + 1`) 표현이 훅마다 흩어져 있다(useUpload 3곳: start·retry·cancel / useAnalysis 2곳: start·cancel).

같은 패턴이 흩어져 있어, 세대 무효화 방식을 바꾸려면 두 파일을 동시에 손봐야 하고 drift 위험이 있다. 단, 두 훅이 관리하는 **자원(타이머·스트림)은 서로 다르다**(analysis만 SSE/폴링 teardown 보유).

## 2. 목표 (Goals)
- G1. 공통 `src/shared/lib/runGuard.ts`(`createRunGuard(getRunId, setRunId)`)로 `nextRun`·`bumpRun`·`isAlive`를 단일화.
- G2. 두 훅이 store의 `runId` 필드를 주입만 하고, 중복 `alive`/`runId + 1` 로직을 제거.
- G3. teardown(타이머·스트림 자원 정리)은 **feature별 자원**이므로 각 훅에 그대로 유지.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 외부 동작(세대 증가 시점·isAlive 판정·취소 후 콜백 폐기·자동 재시작 1회 보장) 변경 — **동작 완전 불변**.
- N2. useUpload의 phase 기반 실행 잠금(`ACTIVE_PHASES`) 변경 — upload 전용이라 그대로 유지(공통화 대상 아님).
- N3. teardown/SSE 재연결/폴링 로직 변경 — analysis 자원이라 그대로.
- N4. store 스키마(`runId: number`) 변경 — 그대로.

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(내부 리팩토링). 업로드·분석 시작/취소/재시작 동작은 이전과 동일.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS(mobile 타입·유닛 테스트 포함, before=after).
- 기존 `useUpload`/`useAnalysis` 테스트가 **무수정 통과**(동작 불변의 증거).
- `alive` 중복 구현 2→1, 세대 bump 경로 단일화.

## 6. 제약 (Constraints)
Expo v57, 서버가 진실의 기준(프론트는 표현만). → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. 장기적으로 runGuard를 store slice 헬퍼로 승격해 `runId` 필드 노출 자체를 감출 수 있음 — 후속(#별도).

### Acceptance
- [x] `src/shared/lib/runGuard.ts` 신설: `createRunGuard(getRunId, setRunId)` → `nextRun()`·`bumpRun()`·`isAlive(runId)`.
- [x] `useUpload`가 runGuard 소비(중복 `alive` 정의·`store.runId + 1` 제거).
- [x] `useAnalysis`가 runGuard 소비(중복 `alive` 정의·`runId + 1` 제거).
- [x] teardown(타이머·스트림 정리)은 `useAnalysis`에 그대로 유지.
- [x] 세대 증가 시점·isAlive 판정·취소 후 콜백 폐기·자동 재시작 1회 보장 완전 동일.
- [x] runGuard 단위 테스트 추가.
- [x] 기존 useUpload/useAnalysis 테스트 무수정 통과.
- [x] `bash agents/harness/evals/checks.sh` PASS.
