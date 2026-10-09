# PRD — 측정 도구 "체크 수동 지시" 교정 + [보완] 반영률 기간 적용

- **이슈:** #184
- **상태**: draft
- **작성**: Claude · **날짜**: 2026-10-09
- **설계 근거**: harness-lab 0031 (PR #44·#45) 이식

## 1. 문제 (Problem)
- `pnpm metrics`의 "사용자의 체크 수동 지시"가 실제보다 크게 나옴.
  - `CHECK_REQUEST`가 "체크박스" 언급만 해도 셈 + 셸 출력·시스템 안내·붙여넣기·대화 요약·uuid 중복까지 포함.
  - 2026-10-02 기록의 "체크해줘 2일 5회(증가)"가 실제 0회였던 오판으로 이어짐.
- `[보완]` 반영률이 `--since`·`--until`을 무시하고 저장소 전체를 셈.

## 2. 목표 (Goals)
- G1. "체크 수동 지시"를 **사용자가 직접 친 요청형**만 세게 한다.
- G2. `[보완]` 반영률에 기간(`--since`/`--until`)을 적용한다.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 복기 참조율 판정 규칙 변경 · N2. `REASON_MARK` 오판 수정(#183) · N3. 앱·서버 코드 · N4. 파일 통째 복사(로직만 이식).

## 4. 사용자 흐름 (측정 흐름)
1. `pnpm metrics --since … --until …` → 체크 수동 지시는 직접 친 요청만, [보완] 반영률은 기간 적용.
2. 연구 세션 제외 재측정에서 체크 수동 지시 3·0·1회 재현.

## 5. 성공 지표 (Success Metrics)
- 연구 세션 뺀 재측정 체크 수동 지시 **3·0·1회**. `checks.sh` PASS.

## 6. 제약 (Constraints)
- 파일 통째 복사 금지 — 로직만 이식, ClauseLens 고유부(REASON_MARK 경로 `../lib/records.mjs`·도구키 `id ?? name+input` 대체·`BASELINE_RATE`·`|TASK-`) 유지.
- ClauseLens 테스트는 `node:test` + `assert/strict`(harness-lab vitest 아님).

## 7. 미해결 질문 (Open Questions)
- Q1. 재측정 검증은 연구 세션 제외 임시 HOME 필요 — 이슈 지시대로 수행.

## Acceptance
- [x] `CHECK_REQUEST` 요청형으로 좁힘 + `typedText`(태그·붙여넣기 제거) + `inPeriod`(UTC) + `toEvents`(대화 요약 제외·uuid 중복 제거·typedText) 이식
- [x] `followupSection(gitDir, since, until)` 기간 적용 + `recallSection` 파일 합쳐 `toEvents` 1회(#45) + ClauseLens 고유부(REASON_MARK 경로·도구키·BASELINE·TASK-) 유지
- [x] `metrics/lib.test.mjs` node:test 단위 11건(실제 요청 3종·언급만 2종·태그 제거·요약·uuid·기간)
- [x] 연구 세션(af7a29b6) 뺀 재측정에서 체크 수동 지시 **3·0·1회** 재현
- [x] `bash agents/harness/evals/checks.sh` ALL PASS
