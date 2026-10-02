# PRD — runId 쓰기 경로 캡슐화(bumpRunWith)

> **이슈:** #138 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
#136(0048-run-guard)에서 stale-run 가드(`runGuard`)는 단일화했으나, `useUpload`·`useAnalysis`가 여전히 `store.set({ runId: runGuard.nextRun(), ...patch })`처럼 **세대(runId)를 외부에서 직접 raw로 set**한다.

- store의 공개 `set(patch)`가 `runId`를 받아들여, 세대 가드를 우회해 임의 값으로 덮을 수 있다(스테일 판정 신뢰성 ↓).
- 세대 증가가 feature 훅에 흩어져 있어, "세대를 어떻게 올리나"의 단일 소유자가 없다.

단, `runId`는 phase·message·documentId 등과 **한 set으로 원자적으로** 올라가야 한다(start/retry/cancel 모두 세대+다른 필드를 묶음 set). 그래서 "runId는 API로만, 다른 필드는 set으로"처럼 단순 분리하면 **원자성이 깨진다**.

## 2. 목표 (Goals)
- G1. `useUploadStore`·`useAnalysisStore`에 **세대 증가 전용 액션** `bumpRunWith(patch)`(= `runId+1`과 patch를 한 set으로)를 둔다.
- G2. 두 훅의 `set({ runId: nextRun(), ...patch })`(upload 3곳·analysis 2곳)를 `bumpRunWith(patch)`로 교체 → 외부가 `runId`를 raw로 set하지 않는다.
- G3. 공개 `set`/`bumpRunWith` patch 타입에서 `runId`를 **제외**(`Omit<Partial<Store>, "runId">`)해 타입으로도 raw set을 차단.
- G4. `runGuard`는 **읽기(isAlive)만** 남긴다(세대 증가 쓰기는 store 전용 액션으로 흡수).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 외부 동작 변경 — 원자성(한 set에 runId+phase+message)·세대 증가 시점·isAlive 판정·취소 후 콜백 폐기 **완전 불변**.
- N2. store 스키마(`runId: number`) 변경·teardown/SSE/폴링 로직 변경 — 그대로.
- N3. ACTIVE_PHASES 실행 잠금·에러 문구·#136 cancel 타이밍(취소 시점 세대 캡처) 의미 변경 — 보존.

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(내부 리팩토링). 업로드·분석 시작/취소/재시작 동작 이전과 동일.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS(mobile 타입·유닛 포함).
- 기존 `useUpload`/`useAnalysis`/`useAnalysisSession` 테스트 **무수정 통과**(동작 불변의 증거).
- `runId` raw set 경로 5곳 → 0곳(전용 액션으로 단일화), 타입으로도 차단.

## 6. 제약 (Constraints)
Expo v57, 서버가 진실의 기준(프론트는 표현만). → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. `runId` 필드 자체를 store 외부 노출에서 숨기는 slice 승격은 범위가 커 후속으로(0048 Q1 연장).

### Acceptance
- [x] `useUploadStore`·`useAnalysisStore`에 `bumpRunWith(patch)` 추가(`set((s)=>({ ...patch, runId: s.runId+1 }))` 의미, 새 세대 반환).
- [x] 공개 `set`/`bumpRunWith` patch 타입에서 `runId` 제외(`Omit<Partial<Store>, "runId">`).
- [x] `useUpload` start·retry·cancel의 `set({ runId: nextRun(), ... })` → `bumpRunWith(...)` 치환.
- [x] `useAnalysis` start·cancel의 세대 set → `bumpRunWith(...)` 치환.
- [x] `runGuard`를 `isAlive`(읽기)만 남기고 `nextRun`/`bumpRun`(쓰기) 제거.
- [x] 원자성·세대 증가 시점·isAlive 판정·취소 후 콜백 폐기·#136 cancel 타이밍 완전 동일.
- [x] `bumpRunWith` 단위 테스트 추가(원자성·현재 세대 기준 +1·raw set 불가).
- [x] 기존 useUpload/useAnalysis/useAnalysisSession 테스트 무수정 통과.
- [x] `bash agents/harness/evals/checks.sh` PASS.
