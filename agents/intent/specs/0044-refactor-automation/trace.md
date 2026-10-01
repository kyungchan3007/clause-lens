# 0044 — trace

- #127 docs 이슈 생성 → `docs/127-refactor-automation` 브랜치(격리 worktree `refactor-auto`, develop 기준)에서 작업.
- 게이트 `check-task-records`가 브랜치 이슈의 spec 폴더를 요구 → 0044 생성. prd(이슈번호·Acceptance 체크박스)·sdd(접근/대안/검증)·trace(실제 과정) 규칙을 `records.mjs`에서 확인 후 작성.
- 야간 자율 루프의 선행 문서라 "머지부터" 진행. 다른 세션이 #118~120을 공유 체크아웃에서 돌리는 중이라 전용 worktree로 격리.
