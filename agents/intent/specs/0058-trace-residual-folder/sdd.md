# 0058 — 잔재 폴더 게이트 오탐 해소 (SDD)

- **관련 PRD**: 0058-trace-residual-folder/prd.md
- **이슈:** #154
- **상태**: draft

## 1. 접근 (Approach)
**A + B 병행** — A로 원인을 없애고, B로 과거/타 경로 잔재까지 방어한다.

**A — 원인 제거(자동 기록 위치 이동)**
- `agents/harness/hooks/trace.mjs`의 `resolveTraceFile`을 `agents/intent/specs/<폴더>/trace.auto.jsonl` →
  `.harness/trace/<폴더>.jsonl`로 변경. spec 폴더 밖이라 브랜치 전환 시 잔재가 생기지 않는다.
- 상수 `TRACE_AUTO_DIR`(`.harness/trace`)·`AUTO_TRACE_BASENAMES`를 `records.mjs`에 공유 추가.
- `.gitignore`: `.harness/trace/`를 미추적으로 추가(과거 패턴 `specs/**/trace.auto.jsonl`도 잔재 커밋 방지용으로 유지).
- 자동 기록을 **읽는** 코드 없음 확인(이슈 근거·재확인): usage=Claude 로그, metrics=`trace.md` 패턴, recall=미참조.

**B — 게이트 보정(방어)**
- `records.mjs`에 `isResidualAutoTraceFolder(projectDir, folder)` 추가 — 아래 좁은 기준일 때만 잔재로 판정:
  1) prd·sdd·trace.md가 전부 없음, 2) 폴더 안이 미추적 자동기록(`trace.auto.jsonl`류)뿐, 3) git 추적 파일 없음.
- `check-task-records.mjs`가 수집 루프에서 잔재 폴더를 `continue`로 건너뜀.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A만 (위치 이동) | 원인 제거·변경 적음 | 과거/타 경로 잔재엔 무력 | ❌(단독) |
| B만 (게이트 스킵) | 기존 잔재도 통과 | 잔재 폴더 자체는 계속 생김·기준 좁히지 않으면 검사 약화 위험 | ❌(단독) |
| **A + B 병행** | 원인 제거 + 과거/타 경로 잔재까지 견고 | 변경 지점 2곳 | ✅ |

**B 단독의 함정 회피**: "git 미추적 파일만 있는 폴더"로 판정하면 커밋 전 현재 태스크 폴더까지 건너뛰어 진짜 누락을
놓친다. 그래서 기준을 "**미추적 `trace.auto.jsonl`류만** 있고 prd·sdd·trace가 전무"로 좁혔다. prd가 있으면
작업 중 폴더로 보고 검사 대상으로 남긴다. 또 현재 브랜치 이슈의 진짜 누락은 check-task-records의
"브랜치 이슈의 spec이 없습니다" 검사가 별도로 잡는다(재현으로 확인함).

## 3. 영향받는 코드 (Touched Surface)
- `agents/harness/hooks/trace.mjs`(`resolveTraceFile`·주석), `agents/harness/lib/records.mjs`(상수·`isResidualAutoTraceFolder`),
  `agents/harness/evals/check-task-records.mjs`(수집 루프 스킵), `.gitignore`.
- 테스트: `trace.test.mjs`, `records.folder.test.mjs`. 문서: `loop.md`, `intent/templates/trace.md`.
- 앱·서버 코드 영향 없음.

## 4. 데이터 / 계약 (Contracts)
- 자동 기록 파일 포맷(JSONL)·내용 불변. 경로만 이동.

## 5. 위험과 완화 (Risks)
- R1 기존 로컬 잔재가 남음 → 완화: B가 게이트에서 건너뜀, gitignore로 커밋 방지. 읽는 코드 없어 기능 영향 없음.
- R2 B 기준이 넓으면 검사 약화 → 완화: 기준을 trace.auto류 전용으로 좁히고 회귀 테스트로 고정.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 하네스 변경만. 되돌리려면 `resolveTraceFile`·gitignore·게이트 스킵을 revert.

## 7. 검증 (Verification)
- 단위: `node --test`로 trace·records.folder 테스트.
- 통합: 재현 절차(잔재 폴더 생성)로 게이트 PASS 확인 + `bash agents/harness/evals/checks.sh` ALL PASS.
