# 0016 — Acceptance 체크박스 완료 반영 규칙 (지침 갱신)

> **관련 태스크**: #55 · **상태**: in-progress · **유형**: docs/governance
> **depends**: [loop.md](../../harness/loop.md)

## PRD (왜/무엇)

### 1. 문제
Acceptance 체크박스를 이슈/spec에 만들어만 두고 **완료 후에도 미체크로 방치** → done인지 후속인지 구분 불가, 혼란(사용자 지적).

### 2. 목표
- RECORD 단계에서 Acceptance를 **이슈 + spec 양쪽** 실제 상태로 갱신하는 규칙 명문화.
- self-check 항목 추가.
- 기존 spec 0013/0014/0015의 완료 항목 체크(정리).

### 3. 비목표
- 이미 닫힌 이슈 소급 편집 자동화 등 — 수동 정리로 충분.

### Acceptance
- [x] loop.md RECORD(step 8) + §Acceptance 갱신 섹션 반영
- [x] self-check에 "Acceptance 체크박스 완료 반영(이슈+spec)" 항목
- [x] spec 0013/0014/0015 완료 항목 체크
- [x] 문서 전용 → checks.sh PASS

## SDD (어떻게)

### ① 접근
`loop.md` 8. RECORD에 "Acceptance 갱신" 추가 + 새 `§Acceptance 갱신` 섹션(완료=`[x]`, 미완=`[ ]`+사유, 부분충족 정직, 이슈+spec+PR 동기화) + self-check 항목. 기존 specs의 완료 박스 체크.

### ② 고려한 대안·트레이드오프
- **A. 별도 규칙 PR(채택)** — 트리거 규칙(#53/PR#54)이 이미 머지돼 develop에 있음 → loop.md를 다시 건드리는 별도 태스크가 자연스러움. 관심사(완료 상태 기록 규칙) 단일.
- **B. #54에 끼워넣기** — 이미 머지돼 불가(사후).
- 기존 specs 체크 정리를 이 PR에 포함: 규칙의 첫 적용이라 응집(트리거 규칙 때와 달리 "적용"이 문서 몇 줄이라 분리 이득 없음).

### ③ 위험
- 없음(문서). 규칙이 과잉 절차로 느껴질 수 있으나, "만들면 닫는다"는 최소 위생이라 수용.

### ④ 검증
- `checks.sh` PASS(문서 전용). 이 spec의 Acceptance를 RECORD에서 체크(규칙 자체 시연).
