# 0026 — 복기 자동 주입 + 효과 측정 — SDD

> **관련 PRD**: prd.md · **이슈:** #85

## 1. 접근 (Approach)
harness-lab의 `recall`·`metrics`를 ClauseLens로 옮긴다. UserPromptSubmit·SessionStart hook이 stdout으로 복기를 컨텍스트에 주입(비차단). 원본은 저장소 안(커밋 `[보완]` + `agents/JOURNAL.md`).

- **복기 원본**: 커밋 `[보완]`(#83부터) 중 이후 언급 안 된 것 + 최근 JOURNAL 항목 + 작업 상태.
- **ClauseLens JOURNAL 파서**: harness-lab는 표(`| ... |`)였지만 ClauseLens는 `## 날짜 · Claude · 제목` 섹션 + `- **무엇**/**다음**` 불릿 → 섹션 파서로 재작성.
- **주입 시점**: 대화별 마지막 주입 날짜·브랜치가 바뀐 첫 요청에만(`shouldInject` + `.recall-state.json`).
- **측정**: `metrics.mjs`가 transcript를 작업 단위로 나눠 첫 수정 전 과거 기록 읽기 비율 계산.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| Notion 복기도 주입 | 게시 기록 활용 | hook이 Notion 못 읽음·게시용 | ❌ |
| 매 요청 주입 | 항상 최신 | 반복·컨텍스트 낭비 | ❌ → 날짜/브랜치 변경 시만 |
| 커밋 [보완] + JOURNAL 파싱 | 저장소 안·hook 접근 가능 | JOURNAL 형식 파서 재작성 | ✅ |

## 3. 영향받는 코드 (Touched Surface)
- `agents/harness/metrics/lib.mjs`(+test) — 측정 순수 함수(extractFollowups·followupMentioned·segmentUnits·summarizeUnits 등)
- `agents/harness/metrics/metrics.mjs` — `pnpm metrics` 리포트
- `agents/harness/hooks/lib/recall.mjs`(+test) — pendingFollowups·recentJournal(ClauseLens 파서)·renderRecap·buildRecap·shouldInject·state
- `agents/harness/hooks/recall-hook.mjs`·`session-context.mjs` — UserPromptSubmit·SessionStart 주입
- `.claude/settings.json`(recall·session-context 배선) · `.gitignore`(.recall-state.json) · package.json(metrics)

## 4. 데이터 / 계약 (Contracts)
주입 텍스트(≤1,500자): 미처리 `[보완]` 목록 + 최근 JOURNAL(날짜·제목·공백) + 작업 상태. 자동 기록: `{event:"RecallInjected", detail:"보완 N개 · 일지 M개"}`.

## 5. 위험과 완화 (Risks)
- R1 "[보완] 처리됨" 판정은 핵심어 매칭 → 오판 가능(주입은 참고용, 비차단).
- R2 주입=전달이지 반영 아님 → **효과 측정으로만 확인**(후속).
- R3 hook 실패가 세션 막음 → stdout 주입은 비차단, runHook catch, exit 0.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
`.claude/settings.json`에서 recall/session-context 제거로 비활성. 파일 삭제로 롤백.

## 7. 검증 (Verification)
- `node --test`(metrics/lib·recall 파서) 통과.
- `recall-hook.mjs`에 UserPromptSubmit JSON을 주입해 첫 요청 주입 + 반복 억제 확인(복사본).
- `pnpm metrics` 실행 → 복기 참조율 리포트 출력.
- `bash agents/harness/evals/checks.sh` (Expo Doctor 기존 드리프트 제외 PASS).
