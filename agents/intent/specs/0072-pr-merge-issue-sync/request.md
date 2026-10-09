<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #183

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/183
- 캡처: 2026-10-09

---
## 배경 — 2026-10-09 재측정 결과
- 개선 이슈 #153·#154·#155 반영 후, 닫힌 이슈 완료 조건의 방치율 (스냅샷: 2026-10-09T06:47Z)
  - 구간 경계는 마지막 개선 이슈 #155가 닫힌 시각(2026-10-02T08:11:48Z)

| 구간 (`closedAt`) | 닫힌 이슈 | 완료 조건 항목 | 체크 | 미체크+사유 | **방치 (미체크·사유 없음)** |
| --- | --- | --- | --- | --- | --- |
| 이식 전 (~9/30) | 39 | 149 | 48 | 12 | **89 (60%)** |
| 이식 후·개선 전 (10/1~#155) | 34 | 134 | 74 | 9 | **51 (38%)** |
| 개선 후 (#155~10/9) | 12 | 77 | 66 | 7 | **4 (5%)** |

- **남은 방치는 1개 이슈뿐: #169**
  - 원본 [specs/0063-result-sheet/prd.md](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/agents/intent/specs/0063-result-sheet/prd.md): 완료 조건 **8/8 체크**
  - 이슈 #169 본문: **0/8 체크**
  - 위 표에서 #169가 4개로 잡힌 이유: 나머지 4개 항목에 `→`·`대체` 글자가 있어 [`REASON_MARK`](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/agents/harness/lib/records.mjs#L25)가 "사유 있음"으로 오판 → **실제 방치는 8개, 엄격히 보면 개선 후 8/77 (10%)**
  - 닫힌 경위: PR #170 머지(2026-10-04T07:57:12Z) → 1초 뒤 자동 닫힘
    - PR 본문·커밋에 `Closes` 같은 닫기 키워드는 없음 — 착수 때 `gh issue develop`으로 만든 **브랜치 연결(Development)** 로 닫힘
- **원인: 동기화가 PR 전에 실행되지 않았다**
  - 규칙상 PR 전에 `pnpm issue-sync`(기본 모드)로 이슈 체크박스를 spec에 맞춰야 함 ([loop.md 29행](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/agents/harness/loop.md#L29))
  - #169는 생성 후 본문 편집 이력 0건 → 기본 모드가 실행되지 않음
  - 연결된 PR 머지로 인한 자동 닫힘은 동기화를 거치지 않음
  - 머지 뒤에는 고칠 도구도 없음
    - `issue-sync`는 **현재 브랜치 이름**에서 이슈 번호를 뽑음 ([issue-sync.mjs 66행](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/agents/harness/evals/issue-sync.mjs#L66)) — 다른 이슈를 지정할 수 없음
    - `--close`는 체크박스를 맞추지 않고 이슈를 닫기만 함 (이미 닫혀 있으면 아무것도 안 함)
  - 즉 #153의 1단계(도구 결함)는 고쳐졌고, **2단계(사람 기억에 기대지 않는 동기화)가 미구현**인 것이 원인
- 측정 방법 (재현 가능)
  - `gh issue list -R kyungchan3007/clause-lens --state closed --limit 300 --json number,closedAt,body`
  - develop의 [records.mjs](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/agents/harness/lib/records.mjs) `acceptanceSection`·`parseChecklist`로 판정 (#153 본문 재현 스크립트와 같은 방식, 구간만 3개)
  - 이식 전 값(149·48·12·89)이 10/2 측정과 똑같이 재현됨
- 기록: Notion OCR 프로젝트 › 10. Harness Engineering "📊 하네스 개선 후 재측정 (2026-10-09)"

## #153에서 넘어온 미완 항목 (3개)
- "#116 유형(spec 미체크·TASKS 행 없음)이 합치기 전에 드러남"
- "2단계 자동화 A/B를 Codex 설계 토론으로 확정·sdd 기록 후 구현, 실제 PR 1건으로 동작 확인"
- "적용 후 1주(또는 닫힌 이슈 15개 이상) 재측정 — 방치율·'체크 수동 지시' 전후 비교"
  - 방치율은 위 표로 이번에 함 (닫힌 이슈 12개, 15개 미만)
  - "체크 수동 지시": 사용자가 직접 입력한 것만 세면 개선 후 1번(10/2 당일), 10/3 이후 0번
    - 측정 도구(`pnpm metrics`)는 도구 출력·대화 요약·붙여 넣은 본문의 "체크"까지 세서 과대 — 10/2 기록의 "2일 5회"는 실제 0번이었음

## 할 일
- 착수 전 **Codex 설계 토론**으로 A/B(또는 조합) 확정 → sdd에 기록
- #153의 2단계 후보 (그대로 이어받음)
  - 후보 A: GitHub Actions — PR merged 시 head 브랜치 → 이슈 번호 → 합쳐진 커밋의 spec Acceptance로 이슈 갱신
    - 전제: `issue-sync`가 `currentBranch`·로컬 작업 트리 대신 **브랜치·기준 ref·이슈 번호를 인자로** 받게 분리
    - 설계 질문: Actions의 `gh` 인증(`GITHUB_TOKEN`, `permissions: issues: write`), fork PR 권한
  - 후보 B: PR CI에서 `--check` 상당 검사 → 이슈와 spec이 어긋나면 실패
  - 기각: 로컬 git hook 단독 (설정 안 된 환경·`--no-verify`로 우회, 네트워크 필요)
  - 기존 워크플로: [.github/workflows/pr-ai-review.yml](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/.github/workflows/pr-ai-review.yml) 하나
- **#116 유형 검출은 폴더 검사만으로는 안 됨** (#153 "착수 전 확인 사항"에서 이어받음)
  - done 검사(`inspectIssueRecords`)는 `TASKS.md`의 done 행에서 출발 → TASKS 행이 없는 spec(예: 0040)은 못 잡음
  - PR 시점에 spec `상태` · TASKS 행 존재 · 사유 없는 미체크를 따로 검사해야 함
- **#169 정정:** 구현한 새 경로(이슈 번호 인자 등)로 #169를 spec 기준으로 맞추는 것을 "실제 동작 확인" 겸 첫 사례로 씀
  - 정정 전 상태는 Notion 측정 기록에 남아 있으므로 기준선 손실 없음 (다른 닫힌 이슈는 그대로 둠)
  - 닫힌 이슈 본문을 고치는 일이라 실행 전에 사용자에게 한 번 확인

## 하지 않을 것
- #169 외 닫힌 이슈의 소급 정정 (측정 기준선으로 보존)
- `REASON_MARK` 오판 수정 — 판정 규칙 변경은 기준선 비교를 깨므로 별도 이슈로 (필요하면)
- 앱·서버 코드

## 완료 조건
- [ ] Codex 설계 토론 → A/B 결정과 이유를 sdd에 기록
- [ ] 이 이슈 자신의 PR로 확인: 머지 후 사람이 아무것도 안 해도 이슈 완료 조건이 spec과 일치
- [ ] spec 미체크 또는 TASKS 행 없는 채 합치려는 경우가 PR 단계에서 드러남 (#116 유형) — 범위 밖으로 미루면 사유 표기
- [ ] #169 이슈 체크박스를 새 경로로 정정 (사용자 확인 후)
- [ ] `bash agents/harness/evals/checks.sh` ALL PASS
- [ ] 재측정 기준을 sdd에 기록 (닫힌 이슈 15개 이상 쌓이면 같은 방법으로, 목표 방치 0건, #169처럼 `REASON_MARK` 오판이 있는지 함께 확인) — 재측정은 그때 별도로, 이 이슈는 기준 기록까지


## 착수 전 확인 사항 (2026-10-09, 올린 뒤 이슈 전달 확인에서 발견)
- **기준 커밋·번호**
  - 이 이슈를 쓴 뒤 develop이 `d4dd9a7`(PR #181 머지)로 바뀌었고 spec 0069가 들어감 → 위 링크의 파일(records.mjs·loop.md·issue-sync.mjs·워크플로)은 그사이 안 바뀜
  - #182도 다음 번호(0070)를 노림 → spec 번호는 착수 시점에 다시 확인
- **이슈 찾는 방법:** #169처럼 본문 키워드 없이 브랜치 연결로 닫히는 경우가 기본 → 설계에서 PR 본문 키워드가 아니라 **head 브랜치 이름 또는 연결 정보(`closedByPullRequestsReferences`)** 로 이슈를 찾을 것
- **설계 토론에서 함께 정할 것 (판단이 갈림)**
  - 자기 검증의 닭과 달걀: "머지 후 사람 개입 없이 일치" 항목은 머지 전 spec에서 체크할 수 없음
    - A 방식이면 Action이 미체크를 그대로 이슈로 복사 → 이미 닫힌 이슈에 사유 없는 미체크가 남아 #169 패턴을 스스로 만듦
    - → 머지 뒤에야 확인되는 항목의 표기(사유 표기 등)와, 머지 후 spec 체크 커밋을 누가 언제 넣는지
  - 연결 PR 머지로 자동으로 닫히면 `--close`의 "사유 없는 미체크면 거부" 가드를 거치지 않음 → 이때 Action이 다시 열지 / 코멘트만 / 무시할지
  - 이슈 문구와 spec 문구가 다를 수 있음 (0063: spec에 "— 시뮬 실측…" 덧붙임, "접히며/접으며")
    - 기본 모드는 섹션 통째 교체라 정정은 됨
    - B(`--check`)는 문구 차이까지 "어긋남"으로 잡아 과하게 실패할 수 있음 → 비교를 체크 상태만으로 할지 정할 것
