# 0048 — 과정 기록 (trace)

## 판단
- **동작 불변이 최우선.** 코드 변경 전 두 훅의 세대 로직을 1:1 대조:
  - `alive`: 두 파일 모두 `useXStore.getState().runId === runId`로 **동일 구현** → `runGuard.isAlive`로 단일화.
  - 세대 bump 시점: useUpload start/retry는 `runId + 1`을 **다른 필드와 묶어 한 번의 `set()`**으로 persist, cancel도 한 set. useAnalysis start도 `reset() → set({runId,...})`로 묶음, cancel만 `set({runId})` 단독.
- **nextRun vs bumpRun 분리 결정.** 처음엔 `bumpRun()`(계산+저장) 하나로 통일하려 했으나, start/retry가 runId를 다른 필드와 한 set에 묶는 구조라 bumpRun을 쓰면 **세대 persist가 별도 set으로 쪼개진다**(set 횟수·타이밍 변경 = 불변 위반). → `nextRun()`(계산만)을 추가해 기존 원자적 set을 보존하고, 단독 bump가 자연스러운 useAnalysis.cancel에만 `bumpRun()` 사용.
- **cancel 순서 검증.** useAnalysis.cancel 원본은 `runId=cur+1 계산 → teardown → reset → set({runId})`. reset()이 `runId`를 보존(필드 목록에 runId 없음)하므로 `teardown → reset → bumpRun()`으로 바꿔도 bumpRun이 reset 뒤 현재값(=cur)+1을 set → **최종 runId·set 횟수 동일**. useUpload.cancel은 `set({ runId: nextRun(), phase, message })`로 한 set 유지.
- **teardown은 feature 자원.** analysis만 SSE close·pollTimer·reopenTimer를 가짐 → runGuard로 끌어올리지 않고 훅에 그대로. runGuard는 순수 세대 숫자만 관리.
- **모듈 레벨 배치.** 두 훅 다 `alive`를 모듈 레벨 헬퍼(fail·putOnce·confirm·applyStatus·beginWatch)에서 호출 → runGuard도 모듈 레벨 상수로 둬 호출부 치환만(React hook화 대안 D 기각).
- **useUpload ACTIVE_PHASES 실행 잠금은 제외.** phase 기반 중복 실행 방지로 upload 전용(analysis엔 없음) → 공통화 대상 아님, 그대로 유지.

## 막힘 / 되돌림
- `bumpRun` 단일 API → start/retry 원자성 깨짐 발견 → `nextRun`(계산만) 추가로 되돌림.
- 치환은 `perl -0pi -e 's/\!alive\(/!runGuard.isAlive(/g'`로 호출부 일괄 변경 후 `function alive` 정의만 수동 삭제(정의 라인의 `alive(` 부분 오치환 방지).

## 검증 결과
- `bash agents/harness/evals/checks.sh` **ALL PASS**(전체 게이트).
- 기존 `useUpload`(4 tests)·`useAnalysis`(6 tests) 테스트가 **수정 없이 통과** = 동작 불변의 증거(세대 증가·isAlive·취소 후 콜백 폐기·자동 재시작 1회 동일). before=after.
- 신규 `runGuard.test.ts` 1 suite / 4 tests 추가. mobile 테스트 before 34 suites/211 → after 35 suites/215.
- 중복 제거: `alive` 동일 구현 2→1(공통 `createRunGuard.isAlive`), 세대 bump 표현 5곳(upload 3·analysis 2)을 `nextRun`/`bumpRun` 2 API로 단일화.
