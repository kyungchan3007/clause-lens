# 0058 — 브랜치 전환 잔재 폴더 게이트 오탐 해소 (PRD)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-02
- **이슈:** #154

## 1. 문제 (Problem)
자동 기록(`trace.auto.jsonl`)이 spec 폴더 안(`agents/intent/specs/<폴더>/`)에 쌓이고 git 미추적이다.
다른 태스크 폴더가 있는 브랜치에서 작업하다 그 spec이 없는 브랜치로 전환하면, git은 추적 파일만 정리하고
미추적 `trace.auto.jsonl`만 남은 **잔재 폴더**가 생긴다. 완료 게이트(`check-task-records`)가 이를
"prd·sdd·trace 없는 spec"으로 오탐해 FAIL → 에이전트는 로컬 파괴 가드에 막혀 못 지우고, 사람이 수동 삭제해야 했다.
(0027·0028·0039·0042에서 반복, JOURNAL·여러 trace에 2회 이상 "별도 이슈 필요"로 기록됨.)

## 2. 목표 (Goals)
- G1. 브랜치 전환 잔재(미추적 자동 기록만 있는 폴더) 때문에 게이트가 실패하지 않는다.
- G2. 원인 자체 제거 — 자동 기록을 spec 폴더 밖(git 미추적)으로 옮겨 잔재가 더 생기지 않게 한다.
- G3. 진짜 누락(prd·sdd 없이 작업 중인 현재 태스크 폴더)은 계속 FAIL — 오탐 제거가 검사 약화가 되면 안 된다.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 체크박스 동기화(#153)·원문 고정(#155).
- N2. 기존 로컬 잔재 `trace.auto.jsonl`을 새 위치로 이전 — 읽는 코드가 없어 버려도 됨.

## 4. 사용자 흐름 (User Flow)
브랜치 전환 후 `bash agents/harness/evals/checks.sh` 실행 → "Task records (folder)" PASS (잔재 폴더가 있어도).

## 5. 성공 지표 (Success Metrics)
- 재현 절차(잔재 폴더 생성)로 게이트 PASS.
- prd·sdd 없는 작업 중 폴더는 여전히 FAIL (회귀 테스트).
- `bash agents/harness/evals/checks.sh` ALL PASS.

## 6. 제약 (Constraints)
- 하네스 전용(앱·서버 코드 영향 없음). 기존 trace 자동 기입 동작·게이트의 진짜-누락 검출 유지.

## 7. 미해결 질문 (Open Questions)
- 없음.

### Acceptance
- [x] A/B 결정과 근거를 sdd에 기록
- [x] 자동 기록을 spec 폴더 밖 `.harness/trace/<폴더>.jsonl`로 이동(원인 제거)
- [x] 재현 절차로 잔재 폴더를 만들어도 게이트 PASS
- [x] 현재 태스크 폴더에 prd·sdd가 없으면 여전히 게이트 FAIL (회귀 테스트)
- [x] 단위 테스트 추가(A: resolveTraceFile 새 경로·spec 밖 / B: 잔재 건너뜀·진짜 누락 유지)
