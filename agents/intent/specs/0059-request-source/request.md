<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #155

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/155
- 캡처: 2026-10-02

---
### 요약
- **원래 요청(이슈 본문)을 고정하고, 모든 단계가 그것을 기준으로 삼게 하는 장치 도입**
  - 특히 검사(리뷰) 단계가 요약본이 아니라 **원문과 대조**하게
- 근거 두 가지
  - 하네스 실험 저장소 **harness-lab**의 측정 결과 (아래)
    - GitHub 저장소 이름은 `kyungchan3007/Harness` — 같은 곳이고, 로컬 폴더 이름이 harness-lab
  - ClauseLens의 PR AI 리뷰가 원문을 보지 않는 구조

### 문제 / 배경
**harness-lab 실험 결과**
- 조건: 같은 쿠폰 과제, 숨겨진 채점 테스트 21~22개, AI 모델 Haiku 4.5, 방식별 3회

| 방식 | 정답률 | 놓친 결함(3회 합) | 평균 시간 · 비용 |
| --- | --- | --- | --- |
| AI 혼자 | 96.8% | 2 | 4.7분 · $0.42 |
| 역할 분리, 원래 요청 전달은 조율 AI가 요약 | **46.0%** | **34** | 10.8분 · $0.88 |
| 역할 분리 + 원문 고정 장치 | **100%** | **0** | 10.1분 · $0.82 |

- 원문 고정 장치 = 요청 원문 파일 + "원문 읽기 전 수정 차단" + 판정서의 원문 대조
- **실패 원인**
  1. 조율 AI가 설계 AI에게 원문 대신 요약("12가지 세부 규칙…")을 넘김
  2. 설계 AI가 규칙·함수 모양을 지어냄
  3. 검사 AI는 그 지어낸 설계 문서를 기준으로 **통과**시킴
  - → 검사자가 따로 있어도 **판단 기준이 원문이 아니면** 결함을 못 잡음
- **효과가 나온 곳**
  - "차단"보다 "원문 파일이 고정된 자리에 있고, 모든 역할 지시가 그 자리를 가리킴"
  - 차단은 실제 실행에서 0번 발동 — 안전망 역할
- **한계**
  - 작은 모델·과제 1개·3회 → "경향"일 뿐
  - ClauseLens에서 그대로 나온다는 보장 없음 → 적용 후 측정 필수
- **근거 문서** (모두 커밋 `213c02a`에 고정)
  - [실험 결과 — 0016 sdd](https://github.com/kyungchan3007/Harness/blob/213c02a/agents/intent/specs/0016-role-split-run/sdd.md)
  - [원문 고정 장치 설계 — 0022 sdd](https://github.com/kyungchan3007/Harness/blob/213c02a/agents/intent/specs/0022-request-source/sdd.md)
  - [채점표 보완 후 재채점 — 0023 sdd](https://github.com/kyungchan3007/Harness/blob/213c02a/agents/intent/specs/0023-oracle-shipping-policy/sdd.md)
  - [구현 PR — Harness #25](https://github.com/kyungchan3007/Harness/pull/25)

**ClauseLens에서 같은 위험이 있는 곳**
- `.github/scripts/pr-ai-review.mjs` (PR 자동 AI 리뷰)
  - 리뷰 입력: PR 제목·본문(181행 `PR BODY`)·커밋 메시지·코드 변경·이미 처리된 지적
  - **연결 이슈(원래 요청)는 입력에 없음** → PR 작성자의 요약을 기준으로 리뷰
- Claude ↔ Codex 교차 검증·설계 토론
  - 원문 대신 요약이 전달될 수 있음
- spec `prd.md`
  - 이슈를 옮겨 적은 것 — 옮기면서 틀려도 이후 단계는 prd만 봄

### 제안하는 변경
- 설계 확정은 착수 시 **Codex 설계 토론 후** (메모리 규칙)
- 적용 순서: ① → ② (가장 작은 변경으로 가장 큰 구멍) → ③ → ④는 측정 후 판단

**① 원문 파일**
- 태스크 폴더에 `request.md` = 이슈 본문을 그대로 복사하는 명령
- 한 번 만들면 수정 차단
- 참고 구현: [harness-lab `request.mjs`](https://github.com/kyungchan3007/Harness/blob/213c02a/agents/harness/evals/request.mjs)
  - `pnpm request [이슈]` — 이슈 본문을 `---` 줄 앞까지 잘라 복사, 이미 있으면 덮어쓰지 않음
- ⚠️ **그대로 옮기면 안 되는 점: 자르는 기준 (가장 중요, 결정 필요)** — 2026-10-02 이슈 전달 확인에서 발견
  - ClauseLens 이슈 76개 중 "닫을 때 채우는 칸"(`### 완료 회고`)이 실제로 있는 이슈는 0개
  - 이유: 이슈를 양식 없이 `gh issue create --body-file`로 만들고 있음
  - 제안: 기본은 본문 전체 복사, 닫을 때 칸(`### 완료 회고`·`---`)이 있으면 그 앞까지
  - → 착수 시 이 기준을 **결정해야 함**
- ⚠️ **수정 차단은 옮길 범위가 생각보다 클 수 있음** — 2026-10-02 이슈 전달 확인에서 발견
  - harness-lab에서 원문 판정을 맡는 곳
    - [`agents/harness/hooks/lib/records.mjs`의 `decideRequest`](https://github.com/kyungchan3007/Harness/blob/213c02a/agents/harness/hooks/lib/records.mjs)
    - 하는 일: 원문 고정, 원문 먼저
  - ClauseLens에서는 `agents/harness/hooks/guard.mjs`가 판정을 `agents/harness/lib/records.mjs`의 `decideEdit`에 넘김
  - 두 파일 모두 request 처리가 없음
  - → **옮길 범위는 `records.mjs`까지 포함**, 착수 시 두 저장소 비교 정리 필요

**② PR AI 리뷰 원문 대조**
- `pr-ai-review.mjs`가 연결 이슈 본문과 `request.md`를 리뷰 입력에 포함
  - 이슈 찾는 방법: `closingIssuesReferences` 또는 브랜치 → 이슈 번호
- 리뷰에 "원문 규칙별 대조" 결과를 포함

**③ 교차 검증(Codex) 지시**
- "판정 기준은 원문, prd·설계는 옮긴 것"을 명시

**④ (선택) 위험 영역에만 역할 분리 + 판정서 원문 대조**
- 대상 후보
  - 결제·구독 (TASK-006, 미착수)
  - 인증 (#126, 열림)
  - 무료 횟수·데이터 삭제 계열 후속 작업 (#90·#74는 이미 닫힘)
- 비용 약 2배 → 전면 적용은 비권장, 범위는 측정 후 결정

### 범위 밖
- 체크박스 동기화 #153, 잔재 폴더 게이트 오탐 #154 (별도 이슈)
- harness-lab의 숨은 채점·실험 실행 장치 이식 (연구용)

### 완료 조건
- [ ] Codex 설계 토론으로 ①~③ 범위·방식 확정, 근거를 spec sdd에 기록 (④는 별도 판단)
- [ ] ① 원문 파일 생성 명령 + 원문 수정 차단 (단위 테스트)
- [ ] ② PR AI 리뷰가 연결 이슈 원문을 입력으로 받고 리뷰에 원문 대조 결과 포함 (실제 PR 1건으로 확인)
- [ ] ③ 교차 검증 지시·지침 문서에 원문 기준 명시
- [ ] 적용 전후 측정 방법 정의·기록 — 예: 원문 대조로 새로 잡힌 지적 수, 머지 후 원 요구사항 누락으로 생긴 fix 이슈 수

### 우선순위
- Medium
- **#153(체크박스 동기화 결함)·#154(잔재 폴더 오탐)를 먼저 처리한 뒤 착수 권장**
  - 원문 파일도 같은 태스크 폴더와 게이트 검사를 쓰기 때문
- 참고: `agents/harness/branch-and-issue.md` 60행은 spec을 "단일 파일"이라 서술
  - 실제는 폴더형(0025~) → `request.md` 위치 판단 근거로 쓰지 말 것 (#153에서 정정 예정)
