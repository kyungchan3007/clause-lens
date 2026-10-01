# 리팩토링 자동화 지침서 (오버나이트 루프)

> 리팩토링 백로그를 **이슈 1개 = 전체 사이클**로 자율 실행하는 플레이북.
> 사용자 부재(야간) 시 CI·코멘트·머지까지 자동으로 진행하되, **게이트·리뷰 통과분만 머지**한다.
> 관련: [branch-and-issue](branch-and-issue.md) · [commit-and-issue](commit-and-issue.md) · [loop](loop.md)

## 0. 원칙 (Non-negotiable)

1. **순차 처리** — 이슈 1개를 머지까지 끝낸 뒤 다음 이슈. 동시 다발 PR 금지(develop 충돌·CI 부하 방지).
2. **게이트 통과분만 PR·머지** — `bash agents/harness/evals/checks.sh` PASS + 단위/e2e 영향분 PASS 전엔 PR 금지.
3. **동작 불변** — refactor는 외부 동작(화면·API·문구) 유지. 변경 시 별도 feat/fix 이슈.
4. **격리 worktree에서 작업** — 공유 체크아웃(다른 세션)과 충돌 금지.
5. **머지는 CI 그린 + 리뷰 해소 후에만.** 레드/미해소면 수정 후 재검.

## 1. 이슈당 루프 (순서)

```
이슈 생성 → 브랜치(gh issue develop) → 구현 → 테스트·게이트 → 커밋(세 섹션)
 → push → PR(base develop) → CI 모니터 → 코멘트 답글·해소 → 머지 → 노션 기록 → 다음 이슈
```

| 단계 | 명령/도구 | 비고 |
| --- | --- | --- |
| 이슈 | `gh issue create --repo <owner>/clause-lens --title "[Refactor] …" --body-file <본문>` | refactor 템플릿 섹션(대상·이유·범위·리스크·우선순위·완료조건) |
| 브랜치 | `gh issue develop <N> --base develop --name refactor/<N>-슬러그` | 숫자=이슈번호 |
| 구현 | worktree에서 편집 | 동작 불변·동시 1브랜치 |
| 게이트 | `bash agents/harness/evals/checks.sh` | PASS 필수 |
| 테스트 | 영향 feature 단위 + e2e 회귀 | refactor는 특성상 기존 테스트가 가드 |
| 커밋 | 세 섹션 `[허점]`·`[보완]`·`[컨텍스트·토큰]` | git hook 강제 |
| PR | `gh pr create --base develop --fill` | 본문에 before/after·수치 |
| CI | **ccd_pr 바인드+모니터** (폴링 금지) | `<ci-monitor-event>`로 결과 수신 |
| 답글 | `gh api …/comments/<ID>/replies -f body=…` | 끝에 Claude Code 귀속 라인 |
| 머지 | CI 그린 + 리뷰 해소 시 머지 | 레드면 수정 후 재검 |
| 기록 | 노션 리팩터 DB + 메트릭 DB | 아래 §3 |

## 2. 리팩토링 분석 기록 (매 이슈 필수)

리팩토링은 "정리"가 아니라 **의사결정 기록**이다. 각 이슈마다 아래를 남긴다.

- **① 왜 이렇게 개발됐나 (원 코드의 이유)** — AI가 처음 이 구조로 만든 맥락·제약(빠른 기능 구현·feature 격리·시간압박 등). 비난이 아니라 "그때는 합리적이었던 이유".
- **② 리팩토링에서 무엇을 중요하게 봤나 (기준)** — 중복 제거·단일 책임·테스트 가능성·경계(레이어)·동작 불변 중 무엇을 우선했는지, 트레이드오프.
- **③ 수치 (그래프용)** — before/after: LOC·중복 건수·파일 수·테스트 수·순환복잡도(가능하면). → 메트릭 DB에 적재.

## 3. 노션 기록

- **리팩터 TASK DB**: 이슈별 1행. 속성 = 제목·상태(🔵완료/🟡진행/🔴대기)·영역·이슈·PR·중요도 + 본문에 **개선점·개선 후·분석①②③**.
- **메트릭 DB**: 수치 전용(그래프 소스). 행 = 이슈별, 열 = 지표(LOC_before·LOC_after·중복_before·중복_after·파일수·테스트수_before·테스트수_after 등 숫자).
- 색 동그라미·불릿 규칙은 [[notion-db-standard]] 준수. 완료·확정=파랑.

## 4. CI·머지 자동화 규칙

- **폴링 금지** — CronCreate·ScheduleWakeup·Monitor·`gh` 반복조회로 CI를 감시하지 않는다. PR 생성 후 ccd_pr로 바인드·모니터하고 앱의 `<ci-monitor-event>`를 기다린다.
- **코멘트 답글**: 자동 리뷰 지적은 `gh api repos/<owner>/clause-lens/pulls/<N>/comments/<ID>/replies -f body=…`로 답하고, 해결 시 resolve. 답글 끝에 Claude Code 귀속 라인.
- **머지 조건**: CI 그린 + 리뷰 P1 전부 해소. 하나라도 미달이면 머지 금지, 수정 후 재검.
- **auto-merge**: 사용자가 야간 자동 머지를 명시 승인한 경우에만. 그 외엔 그린 확인 후 수동 머지.
- **실패 시**: 레드 CI는 원인 수정(Auto-fix 가능 시 활용) 후 재푸시. 2회 이상 같은 실패면 그 이슈는 보류하고 다음으로, 보류 사유를 노션·이슈에 남긴다.

## 5. 안전·중단 기준

- 게이트 FAIL·테스트 레드가 **자력으로 안 풀리면** 그 이슈 PR 금지(드래프트로 두고 다음).
- develop이 중간에 전진하면 각 이슈 브랜치는 머지 전 최신 develop 반영(충돌 해소).
- 범위를 벗어난 발견(새 버그·다른 도메인)은 **섞지 말고** 새 이슈로 분리(세 질문).
