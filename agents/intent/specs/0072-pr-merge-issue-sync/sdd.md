# SDD — PR 머지 시 이슈 체크박스 자동 동기화 (#153 2단계)

- **관련 PRD**: 0072-pr-merge-issue-sync/prd.md
- **이슈:** #183 · **설계 근거**: #153 2단계
- **상태**: approved (적대적 설계 토론 반영 · 사용자 A+B' 확정)

## 1. 접근 방식 (Approach)
사람 기억에 안 기대도록 **머지 시점에 Action이 spec 체크 "상태"를 이슈로 미러**(A)하고, **PR 시점에 spec 준비성(사유 없는 미체크=#116/#169 신호)을 검사**(B')한다. **A+B' 조합**(로컬 훅 단독 기각).

**핵심**
- **Action은 판정자가 아니라 거울** — spec 체크 상태만 복사, 없는 체크를 만들지 않음(거짓 체크 금지).
- **닭·달걀 해소**: 머지 후에만 검증되는 항목은 기존 `REASON_MARK` 규약으로 `- [ ] … — #183`처럼 **사유 있는 미체크**로 둠 → done 게이트가 방치로 안 보고(records.mjs:172), Action이 미러해도 정당(#169 패턴은 "사유 **없는**" 미체크).
- **이슈 찾기**: PR 본문 키워드 X → **head 브랜치명(권위, `branchIssueNumber`) + GraphQL `closingIssuesReferences`(대조)**. 번호 없으면 no-op.
- **문구 vs 상태**: 이슈는 복사본이라 drift가 정상 → 텍스트 동등 비교 안 씀. A는 섹션 통째 교체(`replaceIssueAcceptance`), B'는 "사유 없는 미체크 유무"만.
- **#116 검출**: 기존 `inspectIssueRecords`는 `doneSpecIds`(TASKS done 행) 기반이라 0040류(TASKS 행 없음) 미방문 → PR 시점 `acceptanceSourceForIssue`(TASKS 비의존)로 그 PR의 spec만 검사.
- **보안(A)**: `pull_request_target: [closed]` + `merged==true` 가드 + `issues: write`. **base/merge_commit_sha만 체크아웃·base 저장소 스크립트만 실행·fork 코드 실행/빌드 금지**. 토큰 `GITHUB_TOKEN`(fetch+Bearer).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A(머지 미러)+B'(PR 준비성) | 머지 후 사람 개입 0 + #116 조기 차단 | 워크플로 2개·리팩터 | ✅ |
| B 단독(이슈↔spec 동등 검사) | 조기 차단 | 자동 갱신 아님(사람 여전히 필요)·문구 drift 과다 실패 | ❌ |
| A 단독 | 자동 갱신 | #116 조기 신호 없음 | ❌(B'로 보완) |
| 로컬 git hook | 간단 | 미설정·`--no-verify` 우회·네트워크 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- `agents/harness/evals/issue-sync.mjs`: 순수·주입형 코어 `syncIssueFromSpec({projectDir, issueNumber, mode, getBody, putBody, comment})`로 분리(이슈 번호 인자). CLI 래퍼는 `currentBranch`로 호출(하위호환).
- `agents/harness/lib/records.mjs`: `inspectSpecReadiness(projectDir, issueNumber)`(TASKS 비의존).
- `.github/scripts/lib/github.mjs`(신규): `githubRequest`/`githubGraphQL`(pr-ai-review.mjs에서 추출·공유).
- `.github/scripts/issue-sync-merged.mjs`(신규, A): env→head 브랜치 이슈 + closingIssuesReferences→머지 트리 spec→코어 미러 + 감사 코멘트.
- `.github/scripts/pr-check-spec.mjs`(신규, B'): `inspectSpecReadiness`→사유 없는 미체크면 코멘트+체크런 실패.
- `.github/workflows/pr-issue-sync.yml`(신규): `pull_request_target:[closed]`+merged+`issues:write`. B'는 pr-ai-review.yml에 스텝 추가.
- 테스트: `issue-sync.test.mjs`(주입형 코어)·records 테스트(`inspectSpecReadiness`, 0040식 무행).
- 문서: loop.md·branch-and-issue.md(머지 후 동기화=Action 자동).
- 앱·서버 무관.

## 4. 데이터 / 계약 (Contracts)
- 외부 계약 없음. **BFF**: NO.

## 5. 위험과 완화 (Risks)
- R1 자기 검증 닭·달걀(머지 전 "머지 후 일치" 미검증) → 토론으로 표기·갱신 주체 확정.
- R2 미체크 복사로 #169 패턴 재생성 → 사유 없는 미체크면 거부/코멘트.
- R3 Actions 인증·fork 권한 → `GITHUB_TOKEN`·permissions.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 워크플로/검사 추가. 되돌리기: 워크플로 비활성·issue-sync 인자 분리 복구.

## 7. 검증 (Verification)
- 이 이슈 자신의 PR로 확인(머지 후 사람 개입 0으로 일치).
- #169 정정(사용자 확인 후)으로 첫 동작.
- `checks.sh` ALL PASS.
- **재측정 기준**: 닫힌 이슈 15개 이상, 목표 방치 0건, REASON_MARK 오판 확인 — 재측정은 별도.
