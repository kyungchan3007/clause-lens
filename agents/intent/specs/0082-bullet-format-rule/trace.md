# TRACE — 이슈·PR 본문·리뷰 답글 불릿 형식 규칙 (harness)

- 2026-10-17 착수. 이슈 #203 → 브랜치 `docs/203-bullet-format-rule`(base=develop, #201 머지 포함).
- 계기: #165 Slice 2 PR 리뷰 답글을 문장형으로 올렸다가 사용자 재지적("불릿으로 전부, 필요하면 지침서에 추가"). Claude 메모([[issue-pr-bullet-format]])엔 있었으나 harness 문서엔 없어 Codex 미적용.
- 상충 발견: `github-issue-templates.md`가 "개조식보다 문장 우선" → 불릿 규칙과 충돌 → 정합 필요.

<!-- 이후: 구현 → 게이트 -->

- **구현 완료(2026-10-17)**:
  - `github-pr-review-workflow.md`: "리뷰 지적에 답하기(Auto-fix 응답)" 섹션 신설 — 검증→수정/거짓양성 근거→커밋·푸시→불릿 답글(소제목+짧은 불릿+attribution, 처음부터 불릿)→resolve, 명령·GraphQL 예시.
  - `commit-and-issue.md`: "본문·답글 형식(불릿)" 규칙 — 한 불릿 한 줄·중첩·링크 개별 불릿·제목 간결·notion 원칙.
  - `github-issue-templates.md`: "개조식보다 문장 우선" → "불릿(한 불릿 한 줄·명사형 종결) 기본"으로 정합(상충 제거). 세 문서 상호 참조.
- 게이트: `checks.sh` ALL PASS(문서 변경, typecheck 영향 없음).
