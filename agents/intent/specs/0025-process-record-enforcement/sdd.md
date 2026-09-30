# 0025 — 작업 과정 기록·강제 — SDD

> **관련 PRD**: prd.md · **이슈:** #84

## 1. 접근 (Approach)
harness-lab의 hook 시스템(`trace`·`guard`·`stop-check`)과 판정 로직(`records.mjs`)을 ClauseLens로 옮긴다. Claude Code hook은 `.claude/settings.json`에 배선하고, 로직은 `agents/harness/hooks/*.mjs` + `agents/harness/lib/records.mjs`에 둔다.

- **폴더 spec**: `agents/intent/specs/NNNN-슬러그/{prd,sdd,trace}.md` + `trace.auto.jsonl`. `FOLDER_REQUIRED_FROM=0025`.
- **브랜치→작업 매핑**: 브랜치 이슈번호 → 그 이슈를 가리키는 spec(단일 파일이면 면제, 폴더면 검사). [0023] `records.mjs` 재사용.
- **자동 기록**: `trace.mjs`가 SessionStart·UserPromptSubmit·PreToolUse·PostToolUse·PostToolUseFailure·Stop에서 한 줄씩 append. 비밀값 redact·경로 상대화·도구 결과 미저장.
- **수정 전 차단**: `guard.mjs`(PreToolUse Edit|Write|MultiEdit|NotebookEdit) → `decideEdit` → 차단 시 exit 2.
- **종료 돌려보냄**: `stop-check.mjs`(Stop) → `checkBeforeStop` → `{decision:"block"}` 한 번.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 기존 spec도 폴더로 마이그레이션 | 형식 통일 | 링크 깨짐·소급 작성·토큰 낭비 | ❌ (면제) |
| 단일 파일 유지, 폴더 도입 안 함 | 변화 최소 | trace.auto.jsonl 자리 없음·과정 기록 불가 | ❌ |
| 새 작업부터 폴더 + 기존 면제 | 링크 보존·자동 기록 자리 | 두 형식 공존 검사 | ✅ |
| Claude hook을 라이브 세션에 즉시 활성 | 즉시 검증 | 실행 중 세션 편집 차단·기록 오염 위험 | ❌ → 훅 스크립트에 hook 입력 JSON을 직접 넣어 검증(복사본 규칙) |

## 3. 영향받는 코드 (Touched Surface)
- `agents/harness/lib/records.mjs`(폴더 함수·decideEdit·checkBeforeStop·isRecordPath·changedFiles)
- `agents/harness/hooks/{trace,guard,stop-check}.mjs` + `hooks/lib/io.mjs`
- `agents/harness/evals/check-task-records.mjs` + `checks.sh`
- `.claude/settings.json`(hooks 배선) · `.gitignore`(.unassigned.jsonl)
- 단위 테스트(records 폴더·trace redact/toEntry/resolveTraceFile)

## 4. 데이터 / 계약 (Contracts)
hook 입력(JSON stdin): `hook_event_name`·`tool_name`·`tool_input.file_path`·`session_id`·`cwd`·`stop_hook_active`. 자동 기록 한 줄: `{ts,session,event,tool?,detail?,ok?,blocked?,error?}`.

## 5. 위험과 완화 (Risks)
- R1 라이브 세션에 hook 활성 시 자기 편집 차단·기록 오염 → **활성은 새 세션/복사본**, 검증은 스크립트에 hook JSON 직접 주입.
- R2 두 형식(파일/폴더) 공존 검사 충돌 → check-issue-records(파일)·check-task-records(폴더) 분리.
- R3 trace.mjs 실패가 세션 막음 → 모든 경로 exit 0, runHook catch.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
`.claude/settings.json` hooks 제거로 비활성. checks.sh 줄 제거로 게이트 무력화. 파일 삭제로 롤백.

## 7. 검증 (Verification)
- `node --test`(records 폴더·trace 파서) 통과.
- `guard.mjs`/`stop-check.mjs`에 대표 hook 입력 JSON을 파이프로 넣어 차단(exit 2)·돌려보냄(decision block)·자동 기록 append 확인.
- `bash agents/harness/evals/checks.sh` (Expo Doctor 기존 드리프트 제외 PASS).
