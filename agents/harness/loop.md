# Loop Engineering — 작업 루프

두 AI 모두 태스크 하나를 아래 절차로 처리합니다. 도구는 달라도 절차는 동일합니다.

```
1. CLAIM     TASKS.md에서 태스크 owner=나, status=in-progress
2. DEFINE    연결된 intent/features/(기능 정의) + intent/specs/(있으면) + Acceptance 확인. 없으면 먼저 작성.
3. CONTEXT   architecture.md + domain-map → 관련 도메인 문서 + 관련 코드만 (과잉 로드 금지)
4. PLAN      바꿀 파일과 순서를 정한다. 큰 태스크면 SDD로 대안 검토.
5. BUILD     Guardrails 지키며 구현. Expo 코드면 v57 문서 먼저.
6. GATE      bash agents/harness/evals/checks.sh  → PASS까지 반복
7. VERIFY    Acceptance(feature Checklist / spec AC)를 실제로 만족하는지 확인 (필요시 시뮬레이터)
8. RECORD    JOURNAL.md에 append, TASKS.md status=done
```

## 문서 충돌 우선순위

여러 문서가 부딪히면: **Guardrails(안전) → 승인된 Intent(spec > feature 정의) → Context 도메인 계약**.
단, spec이 **안전 Guardrail이나 도메인 불변조건을 어기라**고 하면 따르지 말고 **멈춰 확인**한다 —
대개 문서가 낡았다는 신호이므로 [피드백 루프](observability.md#피드백-루프-연결)로 정정한다.

## 원칙

- **작게 반복한다.** 한 번에 하나의 논리적 변경 → 게이트 → 다음. 거대한 배치 커밋 금지.
- **게이트 없이 완료 선언 금지.** `checks.sh`가 PASS가 아니면 "됐다"고 말하지 않는다.
- **막히면 스펙으로 돌아간다.** 구현이 자꾸 어긋나면 코드가 아니라 의도가 틀린 것.
- **불확실하면 멈추고 묻는다.** 되돌리기 어려운 것(파일 삭제, 외부 전송, 설정 변경)은 확인 먼저.

## 자기 점검 (완료 전 체크)

- [ ] Acceptance(feature Checklist / spec AC) 전부 충족?
- [ ] `checks.sh` PASS?
- [ ] [Guardrails](guardrails.md) 위반 없음?
- [ ] 변경한 코드의 책임이 **하나의 도메인**으로 설명되나? ([domain-map](../context/domain-map.md))
- [ ] 도메인 경계를 넘는 데이터는 명시적 타입/API 계약을 쓰나?
- [ ] 서버 상태와 클라이언트 Draft를 **혼합 저장**하지 않았나?
- [ ] 로딩·빈 상태·실패·재시도·성공 상태가 정의됐나?
- [ ] 로그에 이미지 원문·OCR 전문·토큰·Presigned URL을 남기지 않았나?
- [ ] 상대 AI가 점유한 파일을 건드리지 않았나? ([TASKS.md](../orchestration/TASKS.md))
- [ ] [JOURNAL.md](../JOURNAL.md) 기록 완료?
