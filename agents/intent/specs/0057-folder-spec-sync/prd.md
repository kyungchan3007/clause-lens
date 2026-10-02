# PRD — 체크박스 동기화·검사가 폴더형 spec을 찾게

> **이슈:** #153 · 상태: in-progress · 유형: fix · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
하네스 이식 3/4(#84)에서 spec을 폴더형(`NNNN-슬러그/prd.md`)으로 바꿨지만, 이식 2/4(#83)에서 만든 체크박스 동기화·검사 도구는 단일 파일(`NNNN-슬러그.md`) 기준 그대로 남았다. 그 결과 0025 이후 폴더형 spec 태스크에서는 도구가 **조용히 무력화**된다.

- `pnpm issue-sync`(및 `--check`·`--close`)가 "이슈 #N을 가리키는 spec이 없습니다"로 실패 → 사람·에이전트가 "체크해줘"를 반복 지시(이식 후 2일에 5회).
- done 미체크 게이트(`inspectIssueRecords`)가 `listSpecs`(단일 파일)만 순회 → 폴더형 spec의 사유 없는 미체크를 검사하지 않음.
- `replaceIssueAcceptance` 정규식이 `## `만 인식 → ClauseLens 이슈 양식이 실제로 만드는 `### 완료 조건` 제목을 교체하지 못하고 중복으로 덧붙일 위험.
- 측정: 이식 후(10/1~) 방치 이슈 19개 전부 폴더형 spec(0029~0056), 18개는 원본 spec은 체크 완료인데 이슈로 복사만 안 됨.

## 2. 목표 (Goals)
- G1. 동기화 도구(`issue-sync`)가 폴더형 spec(`prd.md`의 `### Acceptance`)을 원본으로 찾아 동작.
- G2. done 미체크 게이트가 폴더형 spec도 검사(단일 파일 동작 유지).
- G3. `### 완료 조건`·`## 완료 조건`·`### Acceptance` 제목 모두 인식, 뒤 `###` 섹션을 삼키지 않고 제자리 교체.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 2단계 자동화(GitHub Actions / PR CI) — Codex 설계 토론 후 별도(이 PR은 1단계 도구 결함만).
- N2. #116 유형(TASKS 행 없는 spec)의 합치기 전 차단 장치 — 2단계 설계에서 함께 결정.
- N3. 이미 닫힌 19개 이슈의 체크박스 소급 정정(측정 기준선으로 보존).

## 4. 사용자 흐름 (User Flow)
개발자/에이전트 흐름: 폴더형 spec 브랜치에서 `pnpm issue-sync --check` → spec을 찾아 이슈와 비교. `pnpm issue-sync` → `### 완료 조건`을 spec Acceptance로 제자리 교체. 앱·서버 사용자 영향 없음.

## 5. 성공 지표 (Success Metrics)
- 폴더형 spec 브랜치에서 `issue-sync --check`가 spec을 찾음(spec 없음 오류 소거).
- `bash agents/harness/evals/checks.sh` ALL PASS.
- 단위 테스트: 폴더형 해석·폴더형 done 미체크 검사·`### 완료 조건` 제자리 교체·뒤 `###` 보존.

## 6. 제약 (Constraints)
오프라인 게이트는 네트워크 금지(동기화·닫기만 `gh` 사용). 단일 파일 spec(0001~0024) 동작 보존. → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. 기억에 의존하지 않는 동기화(합치기 시점 자동화)의 방식 A/B — 2단계 Codex 설계 토론에서 확정.

### Acceptance
- [x] 폴더형 spec 태스크 브랜치에서 `pnpm issue-sync`(및 `--check`)가 폴더 spec(`prd.md`의 `### Acceptance`)을 찾는다 — `acceptanceSourceForIssue`로 단일 파일·폴더형 모두 해석.
- [x] `### 완료 조건`·`## 완료 조건`·`### Acceptance`를 인식해 덧붙이지 않고 제자리 교체, 끝 경계를 같은 레벨 이하(### 또는 ##)로 잡아 뒤 `###` 섹션을 삼키지 않음 (단위 테스트·경계 회귀 테스트).
- [x] done 미체크 게이트(`inspectIssueRecords`)가 폴더형 spec도 검사, 단일 파일 spec 동작 유지 (단위 테스트).
- [ ] #116 유형(spec 미체크·TASKS 행 없음)이 합치기 전에 드러남 (후속: PR·합치기 시점 검사 — 2단계 Codex 설계 토론 필요).
- [ ] 2단계 자동화 A/B를 Codex 설계 토론으로 확정·sdd 기록 후 구현, 실제 PR 1건으로 동작 확인 (후속: Codex 설계 토론 필요).
- [ ] 적용 후 1주(또는 닫힌 이슈 15개 이상) 재측정 — 방치율·"체크 수동 지시" 전후 비교 (후속: 측정 필요).
