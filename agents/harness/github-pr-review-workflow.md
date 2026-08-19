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
5. OpenAI Responses API로 리뷰 요청
6. actionable finding만 PR inline review comment로 등록
7. 같은 `head.sha`에 이미 남긴 자동 리뷰가 있으면 중복 실행 생략

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
