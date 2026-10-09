<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #184

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/184
- 캡처: 2026-10-09

---
## 배경 — 측정 도구의 "체크 수동 지시"가 부풀려져 있음
- 2026-10-09 하네스 재측정에서 발견 (Notion OCR 프로젝트 › 10. Harness Engineering "📊 하네스 개선 후 재측정 (2026-10-09)")
- `pnpm metrics`의 "사용자의 체크 수동 지시"가 사용자가 직접 친 요청보다 훨씬 많게 나옴

| 구간 | 도구 값 | **사용자가 직접 친 요청 (손으로 확인)** |
| --- | --- | --- |
| 이식 전 (2026-08-17 ~ 2026-09-28) | 9회 | **3회** |
| 이식 후·개선 전 (2026-09-30T15:00Z ~ 2026-10-02T08:12Z) | 8회 | **0회** |
| 개선 후 (2026-10-02T08:12Z ~ 2026-10-09) | 4회 | **1회** |

- 그래서 2026-10-02 기록의 "체크해줘 2일 5회(오히려 증가)"는 틀린 결론이었음 (Notion에 정정 표시함)
- 잘못 센 원인 5가지 (도구가 센 메시지 22건을 열어 확인 — 최상위 transcript 3개의 사용자 메시지)
  - 사용자가 실행한 셸 명령과 그 출력 — `<bash-input>`·`<bash-stdout>` (예: `checks.sh` 출력의 "체크박스")
  - 이전 대화 요약 — `isCompactSummary: true`
  - 시스템 안내 — `<system-reminder>`
  - 붙여 넣은 글 — `<pasted_content>`, 태그 없이 붙여 넣은 이슈 제목 목록("체크박스 동기화…")
  - 같은 메시지가 이어 하기로 같은 파일에 두 번 기록 — 같은 `uuid` (이식 전 9회 중 3회가 이 중복)
- 함께 발견: `[보완]` 반영률이 `--since`·`--until`을 무시하고 저장소 전체를 셈

## ClauseLens 현재 상태 (develop `d4dd9a7`)
- [metrics/lib.mjs 15행](https://github.com/kyungchan3007/clause-lens/blob/d4dd9a7e60fe4601f6dadf57d6b47124ab573902/agents/harness/metrics/lib.mjs#L15): `CHECK_REQUEST = /체크\s*(해|박스|표시)|check ?box/i` — "체크박스" 언급만 해도 셈
- [toEvents](https://github.com/kyungchan3007/clause-lens/blob/d4dd9a7e60fe4601f6dadf57d6b47124ab573902/agents/harness/metrics/lib.mjs#L48-L60): 요청 원문을 그대로 쓰고, 대화 요약·uuid 중복을 거르지 않음
- [metrics.mjs followupSection](https://github.com/kyungchan3007/clause-lens/blob/d4dd9a7e60fe4601f6dadf57d6b47124ab573902/agents/harness/metrics/metrics.mjs#L75-L88): 기간 인자를 받지 않음 (호출은 93행)

## 할 일 — harness-lab에서 고친 것을 옮기기 (harness-lab 0031, PR [#44](https://github.com/kyungchan3007/Harness/pull/44))
- **파일 통째 복사 금지 — 로직만 옮긴다.** ClauseLens에만 있는 부분은 그대로 유지
  - lib.mjs
    - `REASON_MARK` import 경로: `../lib/records.mjs` (harness-lab은 `../hooks/lib/records.mjs`)
    - 도구 호출 중복 판정: `id`가 없으면 `name+input`으로 대체 키
  - metrics.mjs
    - `BASELINE_RATE = 0.33`과 "기준선 대비" 출력 (15·33·97행)
    - 사유 표지 안내에 `|TASK-` (118행)
    - import에 `inPeriod` 추가 필요
- 옮길 것 (커밋 고정 링크)
  - [`CHECK_REQUEST` 요청형으로 좁힘](https://github.com/kyungchan3007/Harness/blob/33baa4227f704cd95c6d5e39ee481d7793390091/agents/harness/metrics/lib.mjs#L15-L19)
  - [`typedText` — 직접 친 부분만](https://github.com/kyungchan3007/Harness/blob/33baa4227f704cd95c6d5e39ee481d7793390091/agents/harness/metrics/lib.mjs#L21-L25)
  - [`inPeriod` — 시간대 없는 시각은 UTC](https://github.com/kyungchan3007/Harness/blob/33baa4227f704cd95c6d5e39ee481d7793390091/agents/harness/metrics/lib.mjs#L29-L36)
  - [`toEvents` — 대화 요약 제외·uuid 중복 제거·typedText](https://github.com/kyungchan3007/Harness/blob/33baa4227f704cd95c6d5e39ee481d7793390091/agents/harness/metrics/lib.mjs#L67-L94)
  - [`followupSection(gitDir, since, until)` — `[보완]`을 남긴 커밋만 기간 적용, "이후 언급"은 그 뒤 전체에서](https://github.com/kyungchan3007/Harness/blob/33baa4227f704cd95c6d5e39ee481d7793390091/agents/harness/metrics/metrics.mjs#L73-L88), 호출은 [93행](https://github.com/kyungchan3007/Harness/blob/33baa4227f704cd95c6d5e39ee481d7793390091/agents/harness/metrics/metrics.mjs#L93)
  - 전체 변경: [PR #44 diff](https://github.com/kyungchan3007/Harness/pull/44/files)
- 단위 테스트 (harness-lab은 vitest — ClauseLens 형식 `node:test` + `assert/strict`로 바꿔 [metrics/lib.test.mjs](https://github.com/kyungchan3007/clause-lens/blob/d4dd9a7e60fe4601f6dadf57d6b47124ab573902/agents/harness/metrics/lib.test.mjs)에 추가)
  - 참고: [harness-lab 테스트](https://github.com/kyungchan3007/Harness/blob/33baa4227f704cd95c6d5e39ee481d7793390091/agents/harness/metrics/lib.test.mjs#L118-L154)
  - 실제 요청 3종은 셈: "…체크를 체워줘여…", "…이거 체크 안해도 되는거야?", "왜 이슈 체크박스는 확인 안해…"
  - 언급만 한 문장은 안 셈: "* [fix(harness): 체크박스 동기화·검사가 … #153](…)", "체크박스 도구가 단일 파일 가정 → …"
  - 셸 출력·시스템 안내·붙여 넣은 글 제거, 대화 요약·uuid 중복 제외
  - 기간: 시간대 없는 시각 UTC — `inPeriod` 단위 테스트에 한정 (복기 쪽 `recallSection`의 기간 필터는 harness-lab도 아직 문자열 비교)
  - ClauseLens 테스트에는 transcript 줄을 만드는 `user()`/`tool()` 헬퍼가 없음 → 새로 만들 것 (harness-lab 테스트 7~9행 참고)

## 검증 방법 (재측정해서 위 표의 손 확인 값 3·0·1이 나와야 함)
- **주의: clause-lens 폴더의 transcript에는 harness-lab 연구 대화(세션 `af7a29b6-dc4a-48ac-ad09-4d3c0c90a03f`)도 섞여 있음** — 이 세션을 빼고 재야 위 표와 비교 가능
  - 방법: 임시 HOME에 그 세션을 뺀 transcript만 심볼릭 링크하고 실행
    - `~/.claude/projects/-Users-chan-Documents-develop-clause-lens/` 아래 `*.jsonl`과 같은 이름의 폴더 중 `af7a29b6-…`만 빼고 링크
    - `HOME=<임시> node agents/harness/metrics/metrics.mjs --project /Users/chan/Documents/develop/clause-lens --repo kyungchan3007/clause-lens --since … --until …`
      - `pnpm`을 통하지 말 것 (HOME을 바꾸면 pnpm 설정·스토어를 못 찾을 수 있음)
      - `--project`를 꼭 줄 것 (worktree에서 돌리면 기본값이 다른 transcript 폴더를 봄)
  - 구간별: `--since 2026-08-17 --until 2026-09-29` · `--since 2026-09-30T15:00 --until 2026-10-02T08:12` · `--since 2026-10-02T08:12 --until 2026-10-09T06:47`
    - 셋째 구간의 끝을 **측정 시각(2026-10-09T06:47Z)으로 고정** — 그 뒤 세션(구현 세션 자신 포함)이 늘어나도 값이 안 바뀌게
  - 기대: 체크 수동 지시 **3·0·1회** (harness-lab 도구로 같은 방법을 써서 나온 값)
  - 참고로 같은 방법의 복기 참조율은 35%(19/54) · 25%(11/44) · 54%(14/26)

## 하지 않을 것
- `inPeriod`에 잘못된 날짜가 들어오면 `RangeError`로 죽는 동작 — harness-lab과 같게 둠 (CLI 인자 오타는 바로 드러나는 편이 나음)
- 복기 참조율 판정 규칙 변경 (자동 주입 효과를 못 재는 한계는 그대로)
- `REASON_MARK` 오판 (#183에서 다룸)
- 앱·서버 코드

## 완료 조건
- [ ] `CHECK_REQUEST`·`typedText`·`inPeriod`·`toEvents`·`followupSection` 기간 적용 이식 (ClauseLens 고유 차이 2곳 유지)
- [ ] `metrics/lib.test.mjs`에 node:test 단위 테스트 (실제 요청 3종·언급만 2종·태그 제거·요약·uuid·기간)
- [ ] 연구 세션을 뺀 재측정에서 체크 수동 지시 3·0·1회
- [ ] `bash agents/harness/evals/checks.sh` ALL PASS

## 참고
- 다음 spec 번호를 #182·#183도 노림 → 착수 때 번호 다시 확인 (작은 작업이라 이 이슈를 먼저 하는 것을 권장)


## 착수 전 확인 사항 (2026-10-09, 올린 뒤 이슈 전달 확인에서 발견)
- **uuid 중복 제거가 파일을 넘지 못하던 문제 → harness-lab에서 추가로 고침**
  - harness-lab도 `recallSection`이 파일마다 `toEvents`를 따로 불러, 중복 제거가 파일 안에서만 동작했음
  - 고침: 모든 파일의 줄을 합친 뒤 `toEvents`를 한 번 — harness-lab PR [#45](https://github.com/kyungchan3007/Harness/pull/45) (`metrics.mjs` `recallSection` 한 줄)
  - **이것도 함께 옮길 것.** 이번 측정의 중복은 같은 파일 안이라 3·0·1 값은 그대로 (#45 적용 후 재측정으로 확인)
- **`[보완]` 반영률은 `--project` 저장소에 지금 체크아웃된 브랜치의 git 기록을 봄** — 측정 결과가 그때 브랜치에 따라 달라질 수 있음. 완료 조건(체크 수동 지시 3·0·1)에는 영향 없음
- 임시 HOME에는 `memory/` 폴더를 링크하지 않아도 됨 (`.jsonl`만 읽음)
- `toEvents` 링크(`#L48-L60`)는 시작 부분 — 함수는 74행까지
