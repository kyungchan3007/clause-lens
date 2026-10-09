# 0070 — 측정 도구 "체크 수동 지시" 교정 + [보완] 반영률 기간 (TRACE)

- **이슈:** #184 · **설계 근거:** harness-lab 0031 (PR #44·#45)

## 2026-10-09

### 착수
- develop(d4dd9a7·0069 포함)에서 `fix/184-metrics-manual-check` 분기. spec 0070.
- 원문 고정: `pnpm request 184`.
- harness-lab 원본(커밋 33baa42) lib.mjs·metrics.mjs·lib.test.mjs를 gh api로 가져와 로직만 이식(파일 통째 복사 금지).

### 구현
- **lib.mjs**: `CHECK_REQUEST` 요청형으로 좁힘 + `typedText`(NOT_TYPED 태그 제거) + `inPeriod`(asUtc) 신규 + `toEvents`에 대화요약(isCompactSummary) 제외·프롬프트 uuid 중복 제거·typedText 적용.
  - ClauseLens 고유 유지: 도구 중복키 `c.id ?? name+input`(harness-lab은 c.id만), REASON_MARK import `../lib/records.mjs`.
- **metrics.mjs**: `followupSection(gitDir, since, until)` 기간 적용(git `%cI` 커밋일 + inPeriod) · `recallSection` 파일 합쳐 `toEvents` 1회(#45 uuid 교차 중복) · import `inPeriod`.
  - ClauseLens 고유 유지: BASELINE_RATE·기준선 대비 출력·규칙줄 `|TASK-`.
- **lib.test.mjs**(node:test): user()/tool() 헬퍼 + CHECK_REQUEST(3종 셈·2종 안 셈)·typedText·toEvents(요약·uuid·태그)·inPeriod. 단위 11건 PASS.

### 재측정 검증 (2026-10-09)
- 연구 세션(af7a29b6) 제외 임시 HOME에 transcript 심볼릭 링크(링크 3개·제외 1개) 후 구간별 측정.
- 체크 수동 지시: `2026-08-17~09-29` **3회** · `09-30T15:00~10-02T08:12` **0회** · `10-02T08:12~10-09T06:47` **1회** → 이슈 손 확인 값(3·0·1)과 일치.
- checks.sh ALL PASS(metrics lib 11건 포함).

### 남음
- 커밋·PR. (재측정 기준은 sdd에 기록 — 추후 재측정은 별도.)
