# Acceptance Criteria — <기능 이름>

> 모든 스펙에 필수. 체크박스는 **검증 가능**해야 한다(관찰 가능한 결과로 서술).
> 이 목록이 곧 완료 판정 기준이며 [Eval](../../harness/evals/README.md)의 대상이다.

## 기능 기준 (Given / When / Then)
- [ ] **AC1** — Given <초기 상태>, When <행동>, Then <관찰 가능한 결과>.
- [ ] **AC2** —

## 비기능 기준
- [ ] `bash agents/harness/evals/checks.sh` PASS (typecheck + expo-doctor)
- [ ] iOS·Android 양쪽 시뮬레이터에서 크래시 없이 동작
- [ ] Guardrails 위반 없음 ([guardrails.md](../../harness/guardrails.md))

## 범위 밖 (이번엔 검증 안 함)
- <스코프 밖 항목 — Non-goals와 일치>
