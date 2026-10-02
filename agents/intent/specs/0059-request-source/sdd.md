# 0059 — 원문 고정(request.md) + PR AI 리뷰·교차검증 원문 대조 (SDD)

- **관련 PRD**: 0059-request-source/prd.md
- **이슈:** #155
- **상태**: draft
- **설계 토론**: Codex(gpt-6-astra) 2026-10-02 — 결정 근거는 trace.md "설계 토론 결과" 참조.

## 1. 접근 (Approach)
원문(이슈 본문)을 **태스크 폴더에 고정 파일 `request.md`로 복사**하고, 모든 역할(가드·게이트·PR 리뷰·교차검증)이 그 자리를 가리키게 한다. harness-lab 실험에서 효과의 핵심은 "차단"이 아니라 "원문이 고정 위치에 있고 모든 지시가 그 자리를 참조"하는 것. 차단(불변성)은 안전망.

**① 원문 파일 + 생성 도구** (`agents/harness/evals/request.mjs`, `pnpm request <이슈>`)
- 순수 함수(테스트 대상):
  - `buildRequestContent({issue, body, url, capturedAt})` — 헤더(이슈 번호·URL·캡처일·"수정 금지" 주석) + `---` + **이슈 본문 전체**(CRLF→LF, 끝 공백 정리).
  - `writeRequestOnce(path, content)` — 파일이 이미 있으면 **덮어쓰지 않음**(`{created:false}`), 없으면 생성.
- 얇은 I/O: `gh issue view <N> --json body,url`로 본문 조회 → `folderForIssue`로 폴더 해석 → `specs/<폴더>/request.md`에 1회 생성.
- **자르는 기준 = 전체 복사**(Codex 권장). harness-lab의 `---` 앞 자르기는 이식하지 않음 — ClauseLens 이슈엔 `### 완료 회고`가 0개고 `---`가 본문 구분자로 쓰여 추정 절단은 요구 유실 위험.

**② 원문 보호·존재 강제** (`agents/harness/lib/records.mjs`)
- 상수: `REQUEST_FILE="request.md"`, `REQUEST_REQUIRED_FROM="0059"`(도입 이후 신규 spec부터 존재 필수).
- `isRequestPath(relPath)` — `agents/intent/specs/<폴더>/request.md`만 매칭.
- `decideEdit`: **isRecordPath 무조건 허용보다 먼저** 원문 보호 판정.
  - 대상이 request.md이고 **이미 존재**하면 차단(불변) — 최초 생성(미존재)은 허용.
- `inspectTaskFolder`: `id >= REQUEST_REQUIRED_FROM`이면 request.md 존재(비어있지 않음) 필수 → 없으면 problem.
  - 이 함수는 `decideEdit`(requireTrace:false)·`checkBeforeStop`·`check-task-records`가 모두 쓰므로 세 경로에 일관 적용.

**③ PR AI 리뷰 원문 대조** (`.github/scripts/pr-ai-review.mjs` + 순수 모듈 `.github/scripts/lib/review-prompt.mjs`)
- 프롬프트 빌드(`buildReviewPrompt`)와 원문 포맷(`formatOriginalRequest`)을 **env·네트워크 없는 순수 모듈**로 분리(테스트 가능). 현 스크립트는 import 시 env throw·main 실행이라 직접 테스트 불가.
- 원문 수집(역할 구분): **연결 이슈 본문**(GraphQL `closingIssuesReferences`, 실패 시 브랜치→이슈번호 REST 폴백) = 최신 변경 감지·1차 원문, **request.md**(PR 변경 파일에서 탐지해 head SHA contents로 조회) = 착수 시점 판정 기준. 둘 다 best-effort.
- 프롬프트에 "원래 요청(원문 — 판정 기준)" 섹션 + 대조 지시: 각 요구를 **충족/누락/위반/판단불가**로 분류·근거 제시, PR설명·커밋·prd·sdd는 보조, 이슈↔원문 불일치는 "요구 변경 확인 필요"(자동 교체 금지), 누락/위반만 P1. 원문 조회 실패는 "검증 한계"로 요약.

**④ 교차검증 원문 기준 문서화**
- `AGENTS.md`: 절대 규칙에 한 줄 — "요구 충족 판정 기준은 `request.md` 원문, prd·sdd는 파생".
- `agents/harness/branch-and-issue.md`: 상세 절차(생성 시점·전체 복사·고정 경로·정정/변경 처리·리뷰 대조).

**측정(G4)** — 정의는 이 sdd(아래)에 두고, 집계는 PR 리뷰 산출물·이슈 라벨로 한다(별도 파일 불필요):
- M1 원문 대조로 **새로 잡힌 지적 수**: PR 리뷰에서 "원문 누락/위반"으로 보고된 P1 수(도입 전엔 원문이 입력에 없어 0이 베이스라인).
- M2 머지 후 **원 요구 누락으로 생긴 fix 이슈 수**: fix 이슈 본문/라벨에 "원문 누락" 표기해 집계.
- 비교: 도입 전후로 M1(조기 검출↑ 기대)·M2(누락 재작업↓ 기대) 추이를 본다. 작은 표본이므로 "경향"으로만 해석.

## 2. 고려한 대안 (Alternatives)
| 결정 | 대안 | 채택 | 이유 |
| --- | --- | --- | --- |
| 자르는 기준 | `---`/`### 완료 회고` 앞까지(harness-lab) | ❌ | ClauseLens 회고 0개·`---` 본문 사용 → 요구 유실 위험 |
| | **전체 복사** | ✅ | 추정 절단 제거(Codex 권장) |
| 차단 범위 | 불변성만(a) | ❌ | 원문이 "존재"해야 모두 참조 가능 |
| | **불변+존재 강제(b)** | ✅ | 비용 대비 효과(Codex) |
| | +읽기 전 차단(c) | ❌ | 읽음 추적 비용·읽음≠이해 |
| 리뷰 원문 | 이슈만 / request.md만 | ❌ | 한쪽은 최신성·다른쪽은 착수 기준 상실 |
| | **둘 다·역할 구분(c)** | ✅ | 이슈=최신 감지, request=판정 기준(Codex) |
| 문서화 | 새 guidance 파일 | ❌ | 분산·발견성↓ |
| | **AGENTS 1줄+branch-and-issue 상세** | ✅ | 공통 진입점·기존 절차에 통합 |

## 3. 영향받는 코드 (Touched Surface)
- 신규: `agents/harness/evals/request.mjs`, `.github/scripts/lib/review-prompt.mjs`.
- 변경: `agents/harness/lib/records.mjs`(상수·`isRequestPath`·`decideEdit`·`inspectTaskFolder`), `.github/scripts/pr-ai-review.mjs`(원문 수집·프롬프트 분리 사용), `package.json`(`request` 스크립트), `agents/harness/evals/checks.sh`(테스트 목록), `AGENTS.md`, `agents/harness/branch-and-issue.md`.
- 테스트: `agents/harness/lib/records.request.test.mjs`, `.github/scripts/lib/review-prompt.test.mjs`.
- 앱·서버 런타임 영향 없음(하네스·CI 전용).

## 4. 데이터 / 계약 (Contracts)
- `request.md` 포맷: 헤더(주석+메타) + `---` + 이슈 본문 원문(LF). 한 번 생성되면 불변.
- 리뷰 프롬프트에 원문 섹션이 추가됨(출력 JSON 스키마는 불변 — findings 구조 그대로).

## 5. 위험과 완화 (Risks)
- R1 잘못 캡처한 원문도 잠김 → 완화: 정정은 원문 덮어쓰기 금지·별도 변경 기록으로 연결(문서화). 삭제 후 재생성은 가드가 막음(수동 정정 절차 문서화).
- R2 가드 자기참조(0059 자신이 request.md 필요) → 완화: 구현 순서로 request.md 먼저 생성 후 records 요구 추가(trace 기록).
- R3 복수 연결 이슈 혼선 → 완화: spec이 대응 이슈를 prd에 명시, 리뷰는 request.md를 착수 기준으로 우선.
- R4 CI에서 원문 조회 실패 → 완화: best-effort·"검증 한계"로 요약, 리뷰 자체는 계속 진행.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 하네스·CI 변경만. 되돌리려면 records 상수·`isRequestPath`·`decideEdit`·`inspectTaskFolder` 변경과 pr-ai-review·문서를 revert, `request` 스크립트 제거.
- `REQUEST_REQUIRED_FROM="0059"`라 기존 spec(0025~0058)은 영향 없음.

## 7. 검증 (Verification)
- 단위: `records.request.test.mjs`(불변성: 기존 request.md 수정 차단·최초 생성 허용 / 존재 강제: 0059+ 폴더에 request 없으면 problem·0058 이하 면제 / `buildRequestContent`·`writeRequestOnce` 순수 동작), `review-prompt.test.mjs`(원문 섹션·대조 지시 포함, 원문 없을 때 "검증 한계" 문구).
- 통합: `bash agents/harness/evals/checks.sh` ALL PASS.
- ② 실제 확인: 이 PR에서 pr-ai-review가 연결 이슈 원문을 입력에 포함하고 "원문 대조"를 수행하는지 리뷰 산출로 확인(완료 조건).
