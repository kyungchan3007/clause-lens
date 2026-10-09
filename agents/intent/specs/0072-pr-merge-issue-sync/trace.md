# 0072 — PR 머지 시 이슈 체크박스 자동 동기화 (TRACE)

- **이슈:** #183 · **설계 근거:** #153 2단계

## 2026-10-09

### 착수
- develop에서 `feat/183-pr-merge-issue-sync` 분기. spec **0072**(#182가 0071).
- 원문 고정: `pnpm request 183`. prd에 애매한 곳·가정 칸 포함(머지 후 #182 검사 대비).

### 설계 토론 (진행 중)
- 이슈가 A(GitHub Action on merge)/B(PR CI 검사) 선택을 설계 토론으로 요구 → 서브에이전트 적대적 검토(Codex CLI는 지난 태스크들에서 응답 미출력 이력).
- 검토 질문: A/B 결정·자기검증 닭달걀·브랜치연결로 이슈 찾기·문구 vs 체크상태 비교·#116 유형 검출·Actions 인증.
- #169 정정은 닫힌 이슈 본문 수정이라 실행 전 사용자 확인.

### 설계 결론·사용자 확정
- 적대적 리뷰(코드 대조): **A(머지 미러)+B'(PR 준비성)** 권고. 사용자 확정: **A+B' 전체 + #169 지금 정정**.
- 핵심: Action은 거울(상태만 미러)·머지 후 검증 항목은 REASON_MARK 사유 있는 미체크로 역설 해소·이슈는 브랜치명+closingIssuesReferences로 찾음·B'는 사유 없는 미체크만 실패(텍스트 동등 비교 안 씀)·#116은 TASKS 비의존 inspectSpecReadiness로.

### 구현
- `.github/scripts/lib/github.mjs`(신규): fetch+Bearer REST/GraphQL 공유(기존 pr-ai-review.mjs는 회귀 방지 위해 미변경 — 중복 수용).
- `issue-sync.mjs`: 순수 코어 `syncIssueFromSpec`(이슈번호 인자·IO 없음) 분리 + CLI `--issue N`. 기존 순수 fn 재사용.
- `records.mjs`: `inspectSpecReadiness`(TASKS 비의존·사유 없는 미체크=#116/#169).
- `.github/scripts/issue-sync-merged.mjs`(A): 머지 PR→head 브랜치 이슈+closing 대조→머지 트리 spec→미러+감사 코멘트.
- `.github/scripts/pr-check-spec.mjs`(B'): inspectSpecReadiness→사유 없는 미체크면 코멘트+exit 1.
- `.github/workflows/pr-issue-sync.yml`(신규): `pull_request_target:[closed]`+merged+`issues:write`, **merge_commit_sha만 체크아웃·fork 코드 실행 안 함**. B'는 pr-ai-review.yml 스텝 추가.
- 테스트: issue-sync.test(syncIssueFromSpec 4) + records.folder.test(inspectSpecReadiness) — 30건 PASS.
- 문서: loop.md·branch-and-issue.md(머지 자동·B'·--issue).

### #169 정정 (사용자 확인됨)
- `node issue-sync.mjs --issue 169` → 0063-result-sheet/prd.md 기준 **8/8 미러**(이슈는 0/8이었음). 리팩터된 `--issue N` 새 경로 첫 동작 확인 겸.

### 막힘·주의
- 자기 검증 역설: "머지 후 일치" Acceptance 항목은 `— #183` 사유 있는 미체크로 둬 B'·게이트가 방치로 안 봄.
- Action 보안: base/merge_commit_sha만 체크아웃, 의존성 설치/빌드 없음, base 스크립트만 실행.
- Action live 동작은 로컬 미검증(실제 머지 시 확인) — 스크립트는 구문·순수 로직 단위로 검증.

### 검증
- checks.sh ALL PASS(harness 테스트 포함). #169 8/8 확인. 커밋·PR.
