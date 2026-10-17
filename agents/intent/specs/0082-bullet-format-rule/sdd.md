# SDD — 이슈·PR 본문·리뷰 답글 불릿 형식 규칙 (harness)

- **관련 PRD**: 0082-bullet-format-rule/prd.md
- **상태**: draft

## 1. 접근 방식
문서 3개만 수정(코드 무변경).

### `github-pr-review-workflow.md` — "리뷰 지적에 답하기(Auto-fix 응답)" 섹션 신설
- 검증 → 수정 or 거짓양성 근거 → 커밋·푸시(force-push·설정 변경 금지).
- **각 인라인 지적에 답글(reply)을 불릿로**: 굵은 소제목 한 줄 + 짧은 불릿 + 마지막 줄 attribution. **처음부터 불릿**.
- 답글 후 스레드 resolve. 명령·GraphQL 예시.

### `commit-and-issue.md` — "본문·답글 형식(불릿)" 규칙 추가
- 이슈·PR 본문·리뷰 답글 모두 불릿. 한 불릿=한 줄 핵심, 길면 중첩 불릿. 링크 여러 개 개별 불릿. notion 스캔 원칙 동일.

### `github-issue-templates.md` — 문구 정합
- "개조식 나열보다 짧은 명사형 문장 우선" → "스캔 가독성 위해 불릿(한 불릿 한 줄·명사형 종결) 기본".

## 1-1. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| harness 문서 3곳에 규칙 명문화 + 상호 참조 | 두 AI 공통·단일 소스 | 문서 3곳 편집 | ✅ |
| Claude 메모에만 유지(현행) | 편함 | Codex 미적용·상충 방치 | ❌ |
| lint/CI로 자동 강제 | 강제력 | 본문 불릿 판정 난이도·범위 큼 | ❌(후속) |

## 2. 영향받는 코드 (Touched Surface)
- `agents/harness/github-pr-review-workflow.md`(+섹션)
- `agents/harness/commit-and-issue.md`(+규칙)
- `agents/harness/github-issue-templates.md`(문구 1곳 정합)
- 코드·테스트·앱 불변.

## 3. 위험과 완화
- R1. 문서 상충 재발 → 세 문서가 서로 참조(cross-link)해 단일 규칙임을 명시.

## 4. 검증
- `bash agents/harness/evals/checks.sh` ALL PASS(문서 변경이라 typecheck 영향 없음).
- 세 문서 읽어 규칙 일관성 육안 확인.
