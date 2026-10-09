# SDD — 측정 도구 "체크 수동 지시" 교정 + [보완] 반영률 기간 적용

- **관련 PRD**: 0070-metrics-manual-check/prd.md
- **이슈:** #184 · **설계 근거**: harness-lab 0031 (PR #44·#45)
- **상태**: approved (이식 — 설계는 원본에서 확정됨)

## 1. 접근 방식 (Approach)
harness-lab 0031의 로직만 ClauseLens `agents/harness/metrics/`로 옮긴다. 파일 통째 복사 금지 — ClauseLens 고유부는 유지.

**lib.mjs**
- `CHECK_REQUEST` 요청형 regex로 교체(언급만 한 문장 제외).
- `typedText`(+`NOT_TYPED`) 신규 — 셸 입출력·시스템 안내·붙여넣기·명령 태그 제거.
- `inPeriod`(+`asUtc`) 신규 — 시간대 없는 시각은 UTC.
- `toEvents`: 대화 요약(`isCompactSummary`) 제외 · 프롬프트 uuid 중복 제거(`seenPrompts`) · 프롬프트 텍스트에 `typedText`.
  - **ClauseLens 고유 유지**: 도구 중복키 `c.id ?? name+input`(harness-lab은 `c.id`만), REASON_MARK import `../lib/records.mjs`.

**metrics.mjs**
- `followupSection(gitDir, since, until)`: git 포맷에 커밋일(`%cI`) 포함, `[보완]`을 남긴 커밋에만 `inPeriod` 적용(“이후 언급”은 그 뒤 전체).
- `recallSection`: 파일별 `toEvents` → **모든 파일 줄을 합쳐 `toEvents` 1회**(uuid 중복이 파일을 넘게, #45).
- `import`에 `inPeriod` 추가. **ClauseLens 고유 유지**: `BASELINE_RATE=0.33`·"기준선 대비" 출력·규칙줄 `|TASK-`.

**lib.test.mjs** (node:test)
- `user()`/`tool()` transcript 헬퍼 신규.
- CHECK_REQUEST: 실제 요청 3종 셈 / 언급 2종 안 셈.
- typedText: 태그·붙여넣기 제거.
- inPeriod: 시간대 없는 시각 UTC 경계.
- toEvents: 대화 요약 제외·uuid 중복 제거·typedText 적용.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 로직만 이식 + 고유부 유지 | 과대계상 교정·기준선 보존 | 수작업 병합 | ✅ |
| 파일 통째 복사 | 빠름 | REASON_MARK 경로·도구키·BASELINE 깨짐 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- `agents/harness/metrics/lib.mjs`(CHECK_REQUEST·typedText·inPeriod·toEvents).
- `agents/harness/metrics/metrics.mjs`(followupSection 기간·recallSection 합치기·import).
- `agents/harness/metrics/lib.test.mjs`(node:test 단위).
- 앱·서버 무관. checks.sh 77행 테스트 목록에 lib.test.mjs 이미 포함.

## 4. 데이터 / 계약 (Contracts)
- 외부 계약 없음(측정 도구). **BFF**: NO.

## 5. 위험과 완화 (Risks)
- R1 regex 과소/과대 → 실제 요청 3종·언급 2종 단위 테스트로 고정.
- R2 uuid 중복이 파일 경계 → recallSection 합쳐 1회(#45).
- R3 재측정 시 연구 세션 혼입 → 임시 HOME에 연구 세션(`af7a29b6-…`) 제외 링크 후 실행.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 측정 도구만 변경(런타임 영향 없음). 되돌리기: lib.mjs/metrics.mjs 복구.

## 7. 검증 (Verification)
- 단위: `node --test agents/harness/metrics/lib.test.mjs`.
- 재측정(연구 세션 제외 임시 HOME): 체크 수동 지시 3·0·1회(이슈 구간).
- `bash agents/harness/evals/checks.sh` ALL PASS.
- **재측정 기준**: 이후 같은 방법으로 재측정은 별도.
