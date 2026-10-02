# 0059 — 원문 고정 (TRACE · 판단 로그)

- **이슈:** #155

## 2026-10-02

### 착수 · 사전 조사
- 선행 조건 확인: #153(0057)·#154(0058) 모두 develop에 머지됨(0b5a635) → request.md가 쓸 폴더형 spec·게이트 구조 정리 완료. 이슈 권고대로 이제 착수 가능.
- 영향 지점 코드 확인:
  - `hooks/guard.mjs` → `lib/records.mjs:307 decideEdit(projectDir, relPath)`: isRecordPath면 허용, 이슈 브랜치+폴더 prd/sdd 검사. request 처리 없음.
  - `records.mjs:345 checkBeforeStop`: 같은 폴더 검사(trace 포함). request 처리 없음.
  - `.github/scripts/pr-ai-review.mjs:125 buildReviewPrompt`: PR title/body·커밋·변경코드·이미처리 지적만 입력. **연결 이슈 원문 없음.** GraphQL·owner/repo/prNumber 사용 가능.
- 다음 spec 번호: 0059 (0058까지 존재).

### 설계 토론(Codex) — 착수 전 필수(메모리 규칙)
- 결정할 4항목을 Codex에 질의(백그라운드 실행): ① request.md 자르는 기준 ② 수정 차단 범위 ③ 리뷰 원문 소스 ④ 교차검증 문서화 위치.
- 결과는 받는 대로 sdd "접근·대안"에 근거와 함께 반영 예정.

### 설계 토론 결과(Codex, gpt-6-astra) — 채택
- **Q1 자르는 기준 → 전체 복사(채택)**: 회고 섹션이 0개고 `---`는 본문 구분에도 쓰여 추정 절단은 요구 유실 위험.
  harness-lab `request.mjs`의 `---` 앞 자르기는 **이식하지 않음**. 이슈 번호·URL·캡처일은 원문과 분리된 헤더로.
- **Q2 차단 범위 → (b) 채택**: 생성 후 수정·삭제 차단 + decideEdit·checkBeforeStop·게이트에 "존재 필수"(도입 이후 신규 spec=0059~).
  (c)"원문 먼저 읽기 전 차단"은 미채택 — 읽음 추적 비용 크고 읽음≠이해. 구현 주의: isRecordPath 무조건 허용보다
  원문 보호 판정을 **먼저**. 최초 생성은 허용(existsSync로 수정/생성 구분).
- **Q3 리뷰 원문 소스 → (c) 둘 다, 역할 구분(채택)**: request.md=착수 시점 판정 기준, 연결 이슈 본문=최신 변경 감지.
  대조 지시=요구별 충족/누락/위반/판단불가+근거. prd·sdd·PR설명은 보조. 이슈↔원문 불일치는 "요구 변경 확인"으로 보고(자동 교체 X).
  원문 조회 실패는 "검증 한계"로 표시. 구현상 이슈 본문을 1차 원문(API 안정), request.md는 best-effort.
- **Q4 문서화 → AGENTS.md 1줄 + branch-and-issue.md 상세(채택)**: 새 guidance 파일 안 만듦. 역할 지시·리뷰 프롬프트에도 원문 경로 참조 연결.

### 구현 순서(가드 자기참조 회피)
- records.mjs에 request 요구를 넣으면 0059 자신도 request.md가 있어야 함 → 순서: ① sdd ② request.mjs 도구+package script
  ③ `pnpm request 155`로 0059 request.md 생성 ④ records.mjs(불변+존재) ⑤ 테스트 ⑥ pr-ai-review ⑦ 문서 ⑧ 게이트·PR.
- 2차 리뷰 입력 테스트 가능하도록 프롬프트 빌드를 순수 모듈 `.github/scripts/lib/review-prompt.mjs`로 분리(현 스크립트는 import 시 env throw·main 실행).
- 새 테스트 파일은 checks.sh:77 목록에 추가해야 게이트가 실행함.

### 구현 기록
- ① 도구: `agents/harness/evals/request.mjs`(`buildRequestContent`·`writeRequestOnce` 순수 + gh I/O), `package.json` `request` 스크립트. `pnpm request 155`로 0059 request.md 생성(본문 3930자, 재실행 시 덮어쓰지 않음 확인).
- ② 보호/존재: `records.mjs`에 `REQUEST_FILE`·`REQUEST_REQUIRED_FROM="0059"`·`isRequestPath`, `decideEdit`에 불변 가드(isRecordPath보다 먼저·existsSync로 생성/수정 구분), `inspectTaskFolder`에 0059~ 존재 강제(비어있음도 검출).
- ③ 리뷰: 순수 모듈 `.github/scripts/lib/review-prompt.mjs`로 `buildReviewPrompt`·`formatOriginalRequest`·`truncate`·`parseChangedLines` 분리. `pr-ai-review.mjs`는 import로 사용하고 `fetchOriginalRequest(pr,files)` 추가(closingIssuesReferences→브랜치 폴백 이슈 본문 + head SHA의 request.md). 프롬프트에 원문 섹션·요구별 대조 지시·불일치"요구 변경 확인"·원문 없을 때 "검증 한계".
- ④ 문서: AGENTS.md 규칙6, branch-and-issue.md "원문 고정" 절·강제표 갱신.
- 테스트: `records.request.test.mjs`(10) + `review-prompt.test.mjs`(7) 신설, checks.sh 목록 등록.
- 자기참조 함정 실제로 회피됨: request.mjs/package 먼저 → request.md 생성 → records 요구 추가 순서라 가드에 안 막힘.
- 남은 확인: ②의 "실제 PR 1건"은 이 PR의 AI 리뷰가 원문 섹션을 받아 대조하는지로 확정(머지 전 리뷰 산출로 확인).
