# Eval Engineering — 완료 판정 게이트

"됐다"를 감(感)이 아니라 **자동 검사**로 판정합니다. 두 AI 공통의 통과 기준.

## 게이트 실행

```bash
bash agents/harness/evals/checks.sh
```

`checks.sh`는 아래를 순서대로 실행하고, 하나라도 실패하면 non-zero로 종료합니다.

| 검사 | 명령 | 의미 |
| --- | --- | --- |
| Typecheck | `pnpm exec tsc --noEmit` | 타입 오류 0 |
| Expo Doctor | `pnpm dlx expo-doctor` | 환경·의존성 정합성 |

> 린트·유닛 테스트는 아직 미구성. 도입되면 여기(표)와 `checks.sh`에 **한 줄씩** 추가합니다.
> 게이트는 이 저장소의 "CI를 로컬에서 미리 도는" 지점입니다.

## 두 종류의 Eval

1. **엔지니어링 게이트** (지금 자동화됨) — 코드가 빌드/타입/환경 기준을 지키는가.
2. **제품 Eval** (스펙별 수동) — 각 스펙의 **Acceptance Criteria** 체크박스.
   기능 특성상 자동화가 어려운 항목(예: "하이라이트가 올바른 좌표에 그려진다")은
   시뮬레이터에서 확인하고 결과를 [JOURNAL.md](../../JOURNAL.md)에 기록합니다.

## 규칙

- 완료 선언 전 **엔지니어링 게이트 PASS 필수**.
- 게이트를 우회하거나(`// @ts-ignore` 남발 등) 검사를 약화시켜 통과시키지 않는다 —
  그건 [Guardrails](../guardrails.md) 위반.
- 새 검사를 추가할 때는 **빠르고 결정적(deterministic)** 인 것만. 느리거나 불안정한 검사는 게이트에 넣지 않는다.
