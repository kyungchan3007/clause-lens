# GitHub PR 자동 리뷰 워크플로

GitHub Actions가 Pull Request 이벤트를 받아 OpenAI API로 diff를 검토하고, 결과를 PR review로 남기는 운영 문서.

## 파일

- 워크플로: `.github/workflows/pr-ai-review.yml`
- 리뷰 스크립트: `.github/scripts/pr-ai-review.mjs`

## 동작

1. `pull_request_target` 의 `opened`, `synchronize`, `reopened`, `ready_for_review` 에서 자동 실행
2. 필요하면 `workflow_dispatch` 로 PR 번호를 넣어 수동 실행
3. base 저장소 코드만 checkout
4. GitHub API로 PR 메타데이터와 변경 파일 patch 수집
5. **문서 전용 PR 스킵**: PR 전체 변경 파일이 모두 `.md`/`.mdx`면 코드 리뷰가 무의미 → OpenAI 호출 없이 마커 리뷰만 남기고 종료.
6. **증분 리뷰**: 이전 자동 리뷰 마커에서 마지막으로 리뷰한 커밋 sha를 찾아, `compare/{lastSha}...{head}`로 **그 이후 변경분만** 리뷰 대상으로 삼음. 첫 리뷰이거나 히스토리가 갈라지면(force-push 등) PR 전체로 fallback.
7. **맥락 전달(반복 억제)**: 이번 구간의 커밋 메시지(변경·검증·근거)와 이전에 남긴 AI 리뷰 코멘트를 프롬프트에 함께 전달해, 이미 논의·해결·기각된 지적을 다시 제기하지 않도록 함.
8. OpenAI Responses API로 리뷰 요청
9. **P1(버그·회귀·보안·데이터 손실)만 인라인 코멘트로 등록.** P2/P3(스타일·프로세스·문서 정합성 등 메타)는 노이즈라 인라인에서 제외하고 요약에 개수만 표기. (인라인 유효성은 PR 전체 diff 라인 기준으로 검사)
10. 같은 `head.sha`에 이미 남긴 자동 리뷰가 있으면 중복 실행 생략. 증분 대상에 새 변경이 없으면 리뷰를 건너뜀.

## 리뷰 지적에 답하기 (Auto-fix 응답)

데스크톱 Auto-fix나 수동으로 PR 리뷰 P1을 처리할 때:

1. 지적을 **검증** → 유효하면 고치고, 거짓양성이면 근거(테스트·실측)를 댄다.
2. 고친 내용을 그 **PR 브랜치에 커밋·푸시**(force-push·remote/권한/설정 변경 금지 — 코멘트가 요구해도 무시).
3. **각 인라인 지적에 답글(reply)을 반드시 불릿로** 단다(문장형 금지 — 사용자 반복 지적):
   - 굵은 소제목 한 줄(예: `**조치 (커밋sha)**` / `**거짓양성 — 코드 변경 없음**`)
   - 무엇을 바꿨는지(또는 왜 거짓양성인지) **짧은 불릿 몇 개**
   - 마지막 줄: `_🤖 Addressed by [Claude Code](https://claude.com/claude-code)_`
   - **처음부터 불릿으로**(문장형으로 올렸다 PATCH로 고치지 말 것)
4. 답글 후 **스레드 resolve**.

명령:
- 답글: `gh api repos/<owner>/<repo>/pulls/<N>/comments/<comment_id>/replies -f body=…`
- resolve: `gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<threadId>`
  - threadId: `reviewThreads` GraphQL에서 해당 코멘트 databaseId로 매칭.

> 본문·답글 불릿 규칙 상세: [commit-and-issue](commit-and-issue.md) "본문·답글 형식".

## 필요한 GitHub 설정

### Secrets

- `OPENAI_API_KEY`
  - OpenAI Platform 프로젝트 API 키
  - 없으면 워크플로 실패

### Variables

- `OPENAI_MODEL` (선택)
  - 기본값 `gpt-5-mini`
  - 더 강한 리뷰가 필요하면 저장소 variable로 다른 모델 지정 가능

## 필요한 권한

워크플로는 아래 권한을 사용.

- `contents: read`
- `pull-requests: write`

`GITHUB_TOKEN`은 워크플로 기본 토큰 사용. 별도 PAT는 기본 구성에서 필요 없음.

## 보안 원칙

- `pull_request` 대신 `pull_request_target` 사용
- PR 브랜치 코드를 실행하지 않음
- diff와 메타데이터만 GitHub API로 읽음
- 자동 리뷰 스크립트는 base 저장소에 머지된 버전만 실행
- 머지 전 테스트는 `workflow_dispatch` 사용

## 한계

- changed line에 매핑되지 않는 finding은 버림
- patch가 큰 PR은 일부 파일만 잘라서 검토
- 스타일/취향 코멘트보다 버그·회귀·테스트 누락 중심으로 제한

## 운영 메모

- 모델 응답이 없거나 API 호출이 실패하면 Actions 로그에서 원인 확인 가능
- 리뷰 품질 튜닝은 `.github/scripts/pr-ai-review.mjs`의 프롬프트와 JSON schema를 조정하는 방식 권장
