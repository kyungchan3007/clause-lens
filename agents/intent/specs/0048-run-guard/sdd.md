# SDD — 실행 세대(runGuard) 공통화

> **관련 PRD:** 0048-run-guard/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"세대 관리 로직은 공통 팩토리로, 자원 정리는 feature에" 원칙의 재배선. store의 `runId` 필드를 getter/setter로 주입받는 **함수 팩토리**를 택했다(두 store 모두 `runId: number` 평평한 필드 + `set(patch)` 보유 → 구조에 자연스럽게 맞음).

- **신규 `src/shared/lib/runGuard.ts`** — `createRunGuard(getRunId, setRunId): RunGuard`
  - `nextRun(): number` — `getRunId() + 1` **계산만**(저장 안 함). 호출측이 다른 필드와 묶어 한 번의 `set()`으로 원자적 반영할 때 사용.
  - `bumpRun(): number` — `getRunId() + 1`을 계산 후 `setRunId(next)`로 **저장**하고 반환. 단독 세대 증가가 필요한 경우.
  - `isAlive(runId): boolean` — `getRunId() === runId`. 항상 최신 store 상태를 읽어 stale 판별.
- **재배선 — useUpload** (자원 없음)
  - 모듈 레벨 `runGuard = createRunGuard(() => store.runId, (runId) => store.set({ runId }))`.
  - start·retry: `const myRun = store.runId + 1` → `runGuard.nextRun()`. 이후 큰 `set({ runId: myRun, ... })`는 **그대로**(원자적 세대 persist 유지).
  - cancel: `set({ runId: store.runId + 1, phase, message })` → `runGuard.nextRun()`으로 교체(여전히 한 번의 set).
  - 로컬 `function alive` 삭제 → 호출부 `!alive(x)` → `!runGuard.isAlive(x)`.
- **재배선 — useAnalysis** (자원 보유)
  - 모듈 레벨 runGuard 동일 패턴. **teardown()은 그대로 유지**(SSE close·pollTimer·reopenTimer 정리 = analysis 자원).
  - start: `runId + 1` → `nextRun()`. 이후 `reset()` → `set({ runId, documentId, phase })` 순서·원자성 **그대로**.
  - cancel: 원본은 `runId 계산 → teardown → reset → set({runId})`. reset()이 runId를 보존하므로 `teardown → reset → bumpRun()`으로 바꿔도 **최종 runId·set 횟수 동일**(bumpRun이 reset 뒤 현재값+1을 set). nextRun 대신 bumpRun으로 단독 bump 의미를 명시.
  - 로컬 `function alive` 삭제 → `!runGuard.isAlive(x)`.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 함수 팩토리 `createRunGuard(getRunId,setRunId)` + nextRun/bumpRun/isAlive | 두 store 구조에 그대로 맞음, 원자적 set 보존(nextRun), 테스트 쉬움 | API 2종(next/bump) | ✅ |
| B. `bumpRun()`만 제공(계산+저장 합침) | API 1종 | start/retry가 runId를 다른 필드와 한 set에 묶음 → 별도 set 추가 = 세대 persist 횟수/타이밍 변함(불변 위반) | ❌ |
| C. zustand store slice 헬퍼로 승격(runId 필드 은닉) | 캡슐화 ↑ | 두 store 리팩토링 범위 큼, 동작 보존 리스크 ↑(범위 초과) | ❌(후속) |
| D. 공통 React hook(useRunGuard) | 훅 친화 | alive가 모듈 레벨 헬퍼(fail·putOnce·applyStatus 등)에서 호출됨 → 훅 스코프로 못 내림 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 신규: `apps/mobile/src/shared/lib/runGuard.ts`, `apps/mobile/src/shared/lib/runGuard.test.ts`.
- 수정: `apps/mobile/src/features/upload/model/useUpload.ts`, `apps/mobile/src/features/analysis/model/useAnalysis.ts`.
- 새 의존성: 없음(순수 TS, store 주입). Expo 무관.
- 상태: 세대 무효화 로직을 `shared/lib/runGuard.ts`로 단일화. teardown은 feature 유지.

## 4. 데이터 / 계약 (Contracts)
외부 API 계약 변화 없음. store 스키마(`runId: number`) 불변. **BFF 트리거 체크**: 해당 없음(새 API/외부 연동 아님).

## 5. 위험과 완화 (Risks)
- R1 start/retry에서 bumpRun을 쓰면 세대 persist가 별도 set으로 쪼개져 타이밍 변함 → 완화: **nextRun(계산만)**으로 기존 원자적 `set()` 유지.
- R2 cancel에서 compute 시점(teardown 전 vs 후)이 바뀜 → 완화: teardown/reset 모두 runId 미변경이므로 최종값 동일. 기존 테스트(`cancel` 후 타이머 정리·상태)로 확인.
- R3 모듈 레벨 헬퍼(fail·putOnce·confirm·applyStatus·beginWatch)가 alive 의존 → 완화: runGuard도 모듈 레벨에 두어 호출부 치환만(스코프 불변).
- R4 useUpload의 ACTIVE_PHASES 실행 잠금을 건드리면 중복 실행 방지 깨짐 → 완화: 공통화 대상에서 제외, 그대로 유지.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 브랜치. 순수 내부 재배선 → 문제 시 revert.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` PASS — mobile typecheck + 유닛 테스트(기존 useUpload·useAnalysis 테스트가 동작 불변의 증거, before=after).
- 신규 `runGuard.test.ts`: nextRun(계산만·비저장)·bumpRun(계산+저장)·isAlive(현재 세대 판정)·getRunId 최신성 검증.
