# 0028 — expo-constants 57.0.20 정렬 — SDD

> **관련 PRD**: prd.md · **이슈:** #92

## 1. 접근 (Approach)
`apps/mobile`에서 `pnpm dlx expo install expo-constants`로 Expo SDK 57이 요구하는 패치 버전(`~57.0.20`)에 맞춘다. Expo가 SDK에 고정된 버전으로 package.json·lockfile을 정렬한다. 이후 루트 `pnpm install`로 node_modules를 lockfile에 동기화.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| `expo install`로 정렬 | SDK 고정 버전 보장·공식 경로 | lockfile peer 재해석 동반 | ✅ |
| package.json 수기 수정 | 변경 최소 | SDK 요구 버전 수기 확인 필요·실수 여지 | ❌ |
| `expo.install.exclude`로 무시 | 즉시 green | 드리프트 은폐(실제 불일치 잔존) | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- `apps/mobile/package.json` — `expo-constants ~57.0.19 → ~57.0.20`.
- `pnpm-lock.yaml` — expo-constants 재해석 + jest peer(@types/node) 재해석 동반.

## 4. 검증 (Verification)
- `cd apps/mobile && pnpm dlx expo-doctor` → 21/21 통과.
- 루트 `pnpm install` 후 전체 `bash agents/harness/evals/checks.sh` ALL PASS.

## 5. 리스크 / 롤백
- 패치 버전 정렬뿐 — 런타임 영향 없음. 문제 시 lockfile·package.json 되돌리면 복구.
