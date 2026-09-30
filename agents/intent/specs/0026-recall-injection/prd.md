# 0026 — 복기 자동 주입 + 효과 측정 (하네스 이식 4/4) — PRD

> **이슈:** #85 · **관련 태스크**: #85 (chore) · **상태**: in-progress · **유형**: chore (하네스/거버넌스)

## 1. 문제
다음 날 작업할 때 AI가 지난 복기(아쉬운 점·보완할 점)를 보지 않는다. ClauseLens 기준선: 첫 코드 수정 전 과거 기록 참조율 **33%**(66개 중 22개), JOURNAL 참조 66개 중 1개. harness-lab의 **복기 자동 주입**을 옮기고, 같은 측정으로 효과를 확인한다.

## 2. 목표
- G1. 대화 시작·**날짜 변경·브랜치 변경 첫 요청**에 미처리 `[보완]`(이후 언급된 것 제외)·최근 JOURNAL·작업 상태를 AI 컨텍스트로 주입. 같은 날·같은 브랜치 반복 안 함. 1,500자 제한.
- G2. ClauseLens JOURNAL 형식 파싱 + 커밋 `[보완]`(#83부터 쌓임) 읽기.
- G3. 주입 사실이 자동 기록(trace)에 남음.
- G4. `pnpm metrics` — 복기 참조율·체크박스 방치율 측정.

## 3. 목표가 아닌 것 (Non-goals)
- N1. Notion 복기 읽기 — hook이 못 읽음(Notion은 게시용). 저장소 안 원본만.
- N2. 주입이 실제 행동에 반영되는지 **지금 측정** — 데이터 1~2주 필요, "후속".

## 4. 제약 (Constraints)
- Codex엔 Claude hook 미적용. base=develop. 주입은 stdout→컨텍스트(비차단).

## Acceptance
- [x] 대화 시작·날짜 변경·브랜치 변경 첫 요청에서 복기 주입, 같은 날·같은 브랜치에서는 반복 안 함. (`shouldInject`·실측: 재요청 시 빈 출력)
- [x] ClauseLens JOURNAL 형식 파싱 + 커밋 `[보완]` 읽기. (`recentJournal` 섹션 파서·`pendingFollowups` — 실데이터 주입 확인)
- [x] 주입 사실이 자동 기록에 남음. (`RecallInjected` trace 항목)
- [x] 실제 Claude 실행(복사본)으로 주입 확인 — 훅 스크립트에 hook 입력 주입. (recall-hook에 UserPromptSubmit JSON 주입 → 미처리 [보완]·JOURNAL·상태 주입 실측)
- [ ] **효과 측정(후속):** 적용 후 1~2주 뒤 `pnpm metrics`로 복기 참조율을 기준선 33%와 비교해 기록. (현재 `pnpm metrics` 동작 확인·참조율 35% 재출력 · 효과 비교는 데이터 축적 후속 #85)
