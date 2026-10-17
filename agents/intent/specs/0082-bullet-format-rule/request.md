<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #203

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/203
- 캡처: 2026-10-17

---
## 요약
- 이슈·PR 본문, 리뷰 답글을 **불릿 형식**으로 쓰는 규칙을 harness 지침서에 명문화
- 두 AI(Claude·Codex) 공통 적용 — 문장형은 가독성 떨어져 리뷰어·사용자가 못 알아봄

## 배경
- 사용자 반복 지적(2026-10-08·10-17): PR 리뷰 답글을 문장형으로 달면 안 됨, 불릿으로
- 현재 harness 문서에 "답글·본문 불릿" 규칙이 없음 → Codex가 모름
- `github-issue-templates.md`는 오히려 "개조식 나열보다 짧은 명사형 문장 우선"이라 상충 소지

## 제안하는 변경
- `github-pr-review-workflow.md`: "리뷰 지적에 답하기" 섹션 신설(불릿 답글·소제목·attribution·resolve)
- `commit-and-issue.md`: "본문·답글 형식(불릿)" 규칙 추가(한 불릿 한 줄, 링크 개별 불릿)
- `github-issue-templates.md`: "문장 우선" 줄을 불릿 기본으로 정합

## 완료 조건
- [ ] 세 문서에 불릿 규칙 반영(상충 제거)
- [ ] `checks.sh` ALL PASS
