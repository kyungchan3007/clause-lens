# 0023 — 이슈·체크박스 강제 장치 (하네스 이식 1/4)

> **관련 태스크**: #82 (chore) · **상태**: in-progress · **유형**: chore (하네스/거버넌스)
> **depends**: [loop.md](../../harness/loop.md) §브랜치·이슈(#77 규칙) · harness-lab 원본(records·issue-link·issue-sync·branch-and-issue)
> **unblocks**: 하네스 이식 2·3·4 이슈의 기반
> **핵심 결정**: harness-lab 장치를 **발췌·적응**(폴더형·역할·trace 미포함) · **단일 파일 spec** 지원 · base=**develop** · **0023부터** 이슈 번호 필수(0001~0022 면제).

## PRD (왜/무엇)

### 1. 문제
이슈·브랜치 연결 규칙(#77)이 **문서로만** 있어 지켜지지 않는다. #77 자신도 완료 조건 0/2 미체크로 닫혔다. harness-lab 기준선(2026-08~09): 닫힌 이슈의 완료 조건 **61%가 사유 없이 미체크**, "체크해줘" 수동 지시 8회, `Closes #N`이 이슈를 자동으로 못 닫은 경우 다수. **규칙을 장치로 강제**해야 한다.

### 2. 목표
- G1. spec의 **완료 조건을 단일 원본**으로 삼고, 이슈 체크박스를 거기에 맞춘다(`issue-sync`).
- G2. 브랜치가 spec의 이슈에 **실제로 연결**됐는지 확인한다(`issue-link`).
- G3. 도입 번호(0023) 이후 spec에 **이슈 번호가 없으면 게이트 실패**. 기존 spec은 면제.
- G4. TASKS에서 **done**인 작업의 연결 spec에 **사유 없는 미체크**가 있으면 게이트 실패.
- G5. 머지 후 열린 이슈를 닫는다(`issue-sync --close`).

### 3. 목표가 아닌 것 (Non-goals)
- N1. harness-lab의 **폴더형 spec(prd/sdd/trace 분리)·역할 권한·Claude hook**은 이식하지 않는다(이식 3·4에서 별도 판단).
- N2. 오프라인 게이트에서 GitHub 연결 여부까지 검사하지 않는다(네트워크 필요 → `issue-link`는 PR 전 수동).
- N3. fix/새 이슈 경계(세 질문)의 자동 판정. 사람·에이전트 판단으로 남긴다.

### 4. 제약 (Constraints)
- **단일 파일 spec**(`agents/intent/specs/NNNN-슬러그.md`) — 3단계에서 폴더로 바뀌기 전까지 이 형식만 지원.
- 기본 브랜치 **develop** — 머지 확인·브랜치 비교 기준.
- 의존성 추가 없이 **Node 내장(node:test)** 로 테스트. gh CLI는 네트워크 명령에만.

### Acceptance
- [x] 도입 번호(0023) 이후 spec에 이슈 번호가 없으면 완료 게이트(`checks.sh`) 실패, 0001~0022는 면제. (check-issue-records + `ISSUE_REQUIRED_FROM`)
- [x] `pnpm issue-link` 동작 — 현재 브랜치 ↔ spec의 이슈 GitHub 연결 확인. (#82로 실측)
- [x] `pnpm issue-sync` · `--check` · `--close` 동작 — 단일 파일 spec의 Acceptance ↔ 이슈 체크리스트. (sync·--check #82로 실측 · --close는 머지 시 실행)
- [x] TASKS done 작업의 연결 spec에 사유 없는 미체크가 있으면 완료 게이트 실패 (기존 done spec 0001·0021·0022 점검·정리 완료).
- [x] loop.md(#77 규칙)에 명령 연결 + `branch-and-issue.md` 지침 추가.
- [x] 단위 테스트(records·issue-sync 파서) + 이 이슈(#82)로 `issue-sync --check` 실제 동작 확인. (node:test 15개)

## SDD (어떻게)

### 1. 접근
harness-lab의 4개 장치(records `checkPrd`/`inspectTask` 상당 · issue-link · issue-sync · branch-and-issue)를 **ClauseLens 형식으로 재작성**한다. 폴더형·역할·trace는 떼어내고 **이슈 번호 + 체크박스 동기화**만 남긴다.

- **파서 공용 모듈** `agents/harness/lib/records.mjs` (순수 함수, 네트워크 없음 → 단위 테스트).
- **오프라인 게이트** `agents/harness/evals/check-issue-records.mjs` → `checks.sh`에 추가.
- **네트워크 명령** `issue-link.mjs`·`issue-sync.mjs` (gh 사용, 게이트 밖, PR 전/후 수동).

핵심 매핑(ClauseLens 고유): 브랜치명이 **이슈 번호**를 담는다(`chore/82-슬러그`). spec은 `> **관련 태스크**: #NN`(또는 `- **이슈:** #NN`)로 이슈를 가리킨다. 브랜치 이슈번호 → 그 이슈를 가리키는 spec을 찾아 Acceptance를 원본으로 쓴다.

### 2. 고려한 대안
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| harness-lab records.mjs 그대로 복사 | 검증된 코드 | 폴더형·역할·trace 전제라 ClauseLens와 불일치, 대량 미사용 코드 | ❌ |
| 이슈·체크박스만 발췌·적응 | ClauseLens 형식에 맞음, 작게 | 재작성 필요 | ✅ |
| 이슈 번호 마커를 `- **이슈:**`로 신설 | harness-lab과 동일 | 기존 `> **관련 태스크**: #NN` 관례와 이중화 | 절충: **둘 다 인식** |

### 3. 영향받는 코드 (파일·순서)
1. `agents/harness/lib/records.mjs` — `SPECS_DIR`·`TASKS_FILE`·`ISSUE_REQUIRED_FROM="0023"`·`listSpecs`·`readSpec`·`issueNumberOf`·`acceptanceSection`(spec `### Acceptance` / 이슈 `## 완료 조건` 모두)·`parseChecklist`·`REASON_MARK`·`branchIssueNumber`·`specForIssue`·`doneTaskSpecIds`.
2. `agents/harness/lib/records.test.mjs` — 파서 단위(node:test).
3. `agents/harness/evals/check-issue-records.mjs` — (a) 0023+ 이슈번호 필수 (b) done spec 미체크(사유無) 차단.
4. `agents/harness/evals/issue-link.mjs` · `issue-sync.mjs`(+`.test.mjs`) — 재작성.
5. `agents/harness/evals/checks.sh` — `node --test` + `check-issue-records.mjs` 추가.
6. `package.json`(root) — `issue-link`·`issue-sync` 스크립트.
7. `agents/harness/branch-and-issue.md` + `loop.md` 연결.
8. **정리**: done spec(0001·0018·0021·0022) 체크박스 실제 상태로 갱신(체크/사유).

### 4. 위험과 완화
- R1 done spec 대량 미체크 노출 → 이번 태스크에서 실제 상태로 정리(체크 또는 `(후속 #번호)`). 완화: 이식과 정리를 같은 PR에서.
- R2 이슈 본문 섹션명이 `## 완료 조건`(ClauseLens) vs `## Acceptance`(harness-lab) → `acceptanceSection`이 둘 다 인식.
- R3 레거시 브랜치(`task/4b-...`)는 이슈번호 미포함 → issue-link/sync에서 명확한 실패 메시지, 게이트(오프라인)는 영향 없음.

### 5. 롤아웃 / 되돌리기
- 순수 추가(스크립트·문서) + checks.sh 한 줄. 문제 시 checks.sh에서 해당 run 제거로 즉시 무력화, 스크립트 파일 삭제로 롤백.

### 6. 검증
- `node --test agents/harness/**/*.test.mjs` 통과(파서 케이스).
- `bash agents/harness/evals/checks.sh` PASS(새 검사 포함).
- `pnpm issue-sync --check`를 이 브랜치(#82)에서 실행 → spec Acceptance ↔ 이슈 #82 일치 확인.
- `pnpm issue-link` → 브랜치 ↔ #82 연결 확인.
