# 0056 — 과정 기록 (trace)

## 판단
- **왜 직접 set이었나(배경 분석).** #136은 가드를 `nextRun`(계산만)+`bumpRun`(계산+저장)+`isAlive`로 뒀는데, start/retry/cancel은 `runId`를 phase·message·documentId와 **한 set으로 원자적**으로 올려야 해서, 가드의 `bumpRun`(단독 저장)으로는 그 묶음을 표현 못 했다. 그래서 훅이 `nextRun()`으로 숫자만 받고 **직접 `store.set({ runId: …, …patch })`**로 묶어 올렸다 — 이게 `runId`가 공개 `set`에 노출된 원인. 즉 "원자성 요구" 때문에 직접 set이 생겼다.
- **리팩토링 기준: 원자성 보존이 1순위.** 분리형(runId만 API, 나머지 set)은 원자성·set 횟수를 깨므로 기각(대안 B). 대신 "원자 묶음 set" 자체를 store 액션 `bumpRunWith(patch)`로 끌어와, 세대 증가 쓰기의 단일 소유자를 store로 만들었다. 가드는 읽기(isAlive)만 남겼다.
- **세대 읽기 시점 1:1 대조(동작 불변 검증).**
  - upload start/retry/cancel: 모두 **단일 set**이라 `bumpRunWith`로 1:1 치환 — set 횟수·원자성·최종 상태 동일.
  - analysis start: 원본 `nextRun()(캡처) → reset() → set({runId,…})`. reset이 runId 미변경이므로 `reset() → bumpRunWith(…)`로 바꿔도 reset 뒤 현재값(=cur)+1 = 기존 캡처값. set 횟수 2 동일.
  - analysis cancel(#136 취소 시점 캡처): 원본 `nextRun()(teardown 전 캡처) → teardown → reset → set({runId})`. reset이 runId를 보존하므로 `teardown → reset → bumpRunWith({})`가 동일한 cur+1을 set. **최종 runId·set 횟수 동일**. 읽기 시점이 reset 뒤로 옮겨가는 유일한 차이는 reset의 runId-불변 계약에 의해 관측상 무해 → 신규 store 테스트로 그 계약을 고정.
- **raw set 차단 이중화.** 타입(`Omit<Partial<Store>,"runId">`)으로 `set`/`bumpRunWith`가 `runId`를 못 받게 + 런타임에서 `runId`를 spread 마지막에 둬 patch가 못 덮게. 테스트로 `set({phase})`는 runId 불변, `bumpRunWith`만 +1 확인.
- **runGuard 축소.** `nextRun`/`bumpRun`/`setRunId`는 쓰기 경로라 store로 흡수 → 제거. 가드는 `createRunGuard(getRunId) → { isAlive }`. 호출부(fail·applyStatus·beginWatch 등 모듈 레벨)는 isAlive만 쓰므로 불변.

## 막힘 / 되돌림
- analysis.cancel을 `bumpRunWith` 먼저 → reset 순으로 짜면 set 순서가 바뀌어 중간 알림 시퀀스가 달라진다(관측 차이) → **reset → bumpRunWith 순서 유지**로 되돌려 set 순서·최종 상태를 원본과 일치시킴.
- `runGuard.test.ts`는 제거된 `nextRun`/`bumpRun`을 검증하던 2개 테스트를 삭제하고 isAlive·최신성 2개만 유지(API 축소에 따른 불가피한 수정, useUpload/useAnalysis 테스트는 무수정).

## 검증 결과
- `bash agents/harness/evals/checks.sh` **ALL PASS**(전체 게이트).
- mobile 유닛: 40 suites / 244 tests PASS. 기존 useUpload(4)·useAnalysis(6)·useAnalysisSession 테스트 **무수정 통과** = 동작 불변 증거(before=after).
- 추가: `uploadStore.test.ts`(4)·`analysisStore.test.ts`(4) 신규 2 suites. `runGuard.test.ts` 4→2 tests(제거 API 정리). 순증 +2 suites / +6 tests(238→244).
- raw set 경로 5곳(upload start·retry·cancel / analysis start·cancel) → 0곳. `runId` 쓰기는 `bumpRunWith` 단일 경로 + 타입 차단.
