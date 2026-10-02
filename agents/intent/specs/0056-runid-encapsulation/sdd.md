# SDD — runId 쓰기 경로 캡슐화(bumpRunWith)

> **관련 PRD:** 0056-runid-encapsulation/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"세대(runId) 쓰기는 store가 소유, 판정(isAlive)은 가드가 소유"로 역할을 가른다. #136은 가드(`runGuard`)에 `nextRun`(계산만)+`bumpRun`(계산+저장)+`isAlive`를 뒀지만, 실제 세대 persist는 훅이 `store.set({ runId: nextRun(), ...patch })`로 직접 하므로 `runId`가 공개 `set`을 통해 **raw로 노출**됐다. 이를 store의 전용 액션으로 흡수한다.

- **store 전용 액션 `bumpRunWith(patch)`** (uploadStore·analysisStore 동일 형태)
  ```ts
  bumpRunWith: (patch) => {
    const next = get().runId + 1;
    set({ ...patch, runId: next }); // runId를 마지막에 둬 patch가 못 덮게
    return next;                    // isAlive용 새 세대 반환
  }
  ```
  - `runId+1`과 다른 필드를 **한 번의 set**으로 → 기존 원자성(한 set에 runId+phase+message) 그대로.
  - `get().runId`를 set 직전에 읽어 **항상 현재 세대 기준 +1**. 반환값으로 훅이 `isAlive(myRun)` 유지.
- **타입으로 raw set 차단** — 공개 `set`/`bumpRunWith`의 patch를 `Omit<Partial<Store>, "runId">`(=`UploadPatch`/`AnalysisPatch`)로. 내부 zustand `set`만 `runId`를 쓴다(bumpRunWith·reset).
- **runGuard 축소** — `createRunGuard(getRunId)` → `{ isAlive }`만. `nextRun`/`bumpRun`(+`setRunId` 주입) 제거. 세대 증가 쓰기 경로가 store로 이동했으므로 가드는 읽기 전용.
- **훅 재배선(동작 불변)**
  - upload.start: `const myRun = nextRun(); set({ runId: myRun, phase:"presigning", ... })` → `const myRun = store.bumpRunWith({ phase:"presigning", ... })`. 한 set 유지.
  - upload.retry: `set({ phase:"uploading", runId: myRun, message: undefined })` → `bumpRunWith({ phase:"uploading", message: undefined })`.
  - upload.cancel: `set({ runId: nextRun(), phase:"idle", message })` → `bumpRunWith({ phase:"idle", message })`. 단일 set·원자성 그대로.
  - analysis.start: `nextRun() → reset() → set({ runId, documentId, phase })` → `reset() → bumpRunWith({ documentId, phase })`. reset이 runId 보존 → set 횟수(2)·최종 runId 동일.
  - analysis.cancel: `nextRun()(캡처) → teardown → reset → set({ runId })` → `teardown → reset → bumpRunWith({})`. reset이 runId 보존하므로 reset 뒤 현재값+1 = 기존 캡처값. set 횟수(2)·최종 runId 동일(#136 취소 시점 세대 증가 보존).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. store 전용 액션 `bumpRunWith(patch)`(원자 set) + 가드는 isAlive만 | 원자성 보존, 세대 쓰기 단일 소유자, 타입으로 raw set 차단 | store마다 액션 1개 추가 | ✅ |
| B. runId만 올리는 `bumpRun()` API + 다른 필드는 별도 set | API 단순 | 세대 persist가 별도 set으로 쪼개짐 → 원자성·set 횟수·타이밍 변경(불변 위반) | ❌ |
| C. `set`은 그대로 두고 규약(문서)으로만 raw set 금지 | 코드 변경 최소 | 강제력 없음(타입/런타임 우회 가능) = 캡슐화 목적 미달 | ❌ |
| D. 가드의 `bumpRun`에 patch 인자 추가(가드가 store.set 호출) | 가드 1곳 집중 | 가드가 store 쓰기까지 소유→책임 비대, setRunId 주입이 곧 raw set 노출 유지 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 수정: `apps/mobile/src/features/upload/model/uploadStore.ts`·`useUpload.ts`, `.../analysis/model/analysisStore.ts`·`useAnalysis.ts`, `shared/lib/runGuard.ts`.
- 테스트: `runGuard.test.ts`(제거된 nextRun/bumpRun 테스트 정리), 신규 `uploadStore.test.ts`·`analysisStore.test.ts`.
- 새 의존성: 없음(순수 TS·zustand get 추가). Expo 무관. store 스키마 불변.

## 4. 데이터 / 계약 (Contracts)
외부 API 계약 변화 없음. store 스키마(`runId: number`) 불변. **BFF 트리거 체크**: 해당 없음.

## 5. 위험과 완화 (Risks)
- R1 analysis.cancel/start의 세대 읽기 시점이 reset 뒤로 이동 → 완화: reset이 `runId`를 미변경(필드 목록에 runId 없음, 신규 store 테스트로 고정) → 최종값·set 횟수 동일. #136 취소 시점 세대 증가 의미 보존.
- R2 start/retry가 runId를 다른 필드와 묶음 set → 완화: `bumpRunWith`가 그 묶음을 한 set으로 수행(대안 B 기각).
- R3 patch가 runId를 덮을 위험 → 완화: 타입 `Omit<…,"runId">` + 런타임에서 `runId`를 spread 마지막에 배치.
- R4 모듈 레벨 헬퍼(fail·applyStatus·beginWatch 등)의 isAlive 의존 → 완화: 가드 모듈 레벨 유지, 호출부 불변.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 브랜치. 순수 내부 재배선 → 문제 시 revert.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` PASS — mobile typecheck + 유닛(기존 useUpload·useAnalysis·useAnalysisSession 테스트가 동작 불변의 증거, before=after).
- 신규 store 테스트: `bumpRunWith`가 `runId+1`·patch를 1회 알림(원자)·현재 세대 기준 증가·reset 뒤 보존·patch가 runId 못 덮음·`set`은 runId 불변.
