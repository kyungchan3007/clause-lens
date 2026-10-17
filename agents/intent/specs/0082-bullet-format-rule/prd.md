# PRD — 이슈·PR 본문·리뷰 답글 불릿 형식 규칙 (harness)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-17
- **이슈:** #203

## 1. 문제 (Problem)
- 사용자 반복 지적(2026-10-08·10-17): GitHub 이슈·PR 본문·리뷰 답글을 **문장형**으로 쓰면 가독성이 떨어져 리뷰어·사용자가 못 알아봄.
- harness 문서에 "답글·본문 불릿" 규칙이 없어 Codex가 모름(Claude 메모에만 존재).
- `github-issue-templates.md`는 "개조식 나열보다 짧은 명사형 문장 우선"이라 불릿 규칙과 **상충** 소지.

## 2. 목표 (Goals)
- G1. 리뷰 답글(Auto-fix 응답 포함) 작성 형식을 `github-pr-review-workflow.md`에 불릿로 명문화.
- G2. 이슈·PR 본문 불릿 규칙을 `commit-and-issue.md`에 추가(한 불릿 한 줄·링크 개별 불릿).
- G3. `github-issue-templates.md`의 "문장 우선" 문구를 불릿 기본으로 정합(상충 제거).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 기존 이슈·PR 소급 교정(이번은 지침서만).
- N2. 린트/CI 자동 강제(문서 규칙까지, 자동 검사는 후속).

## 4. 성공 지표
- 두 AI가 같은 규칙을 참조 가능(문서 상충 없음). `checks.sh` ALL PASS(문서 변경).

### Acceptance
- [x] `github-pr-review-workflow.md`에 "리뷰 지적에 답하기(불릿)" 섹션
- [x] `commit-and-issue.md`에 "본문·답글 형식(불릿)" 규칙
- [x] `github-issue-templates.md` 문구 정합(불릿 기본)
- [x] `bash agents/harness/evals/checks.sh` ALL PASS

## 5. 제약
- 문서만 변경(코드·동작 불변). 문서 전용 PR이라 AI 리뷰 스킵(github-pr-review-workflow 5).

## 6. 애매한 곳·가정 (Open Questions)
- 명사형 종결(issue-templates 문체)과 불릿은 양립 — "불릿(한 불릿 한 줄·명사형 종결)"으로 통합 (가정)
- 자동 강제(lint)는 이번 범위 밖, 규칙 문서화만 (확인됨: 이슈 완료조건)
