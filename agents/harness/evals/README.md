# Eval Engineering — 완료 판정 게이트

"됐다"를 감(感)이 아니라 **자동 검사**로 판정합니다. 두 AI 공통의 통과 기준.

## 게이트 실행

```bash
bash agents/harness/evals/checks.sh
```

`checks.sh`는 아래를 순서대로 실행하고, 하나라도 실패하면 non-zero로 종료합니다.

| 검사 | 명령 | 의미 |
| --- | --- | --- |
| Typecheck (mobile) | `pnpm --filter @clause-lens/mobile exec tsc --noEmit` | 앱 타입 오류 0 |
| Typecheck (api) | `pnpm --filter @clause-lens/api exec tsc --noEmit` | 백엔드 타입 오류 0 |
| Prisma schema validate | `prisma validate`(더미 DATABASE_URL) | 스키마 유효 |
| Expo Doctor | `pnpm dlx expo-doctor` | 환경·의존성 정합성 |
| No npm/yarn lockfiles | find 기반 | pnpm 단일 사용 |
| Native modules single version | `check-native-singletons.mjs` | RN 계열 단일 버전 |
| **Unit tests (api)** | `pnpm --filter @clause-lens/api test` | 백엔드 로직(auth 등) |
| **Unit tests (mobile)** | `pnpm --filter @clause-lens/mobile test` | 앱 상태·저장·API |

> 표는 참고용이며 **진실의 소스는 `checks.sh`**. 새 검사는 거기 한 줄 추가하고 이 표도 갱신.
> 유닛 테스트 위치: api `src/**/*.spec.ts`(Jest+ts-jest), mobile `src/**/*.test.ts`(jest-expo).
> **e2e 시나리오/Maestro 플로우**는 `apps/mobile/.maestro/`(SCENARIOS.md + `*.yaml`) — maestro CLI 필요라 게이트엔 미포함(수동/후속 CI).
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
