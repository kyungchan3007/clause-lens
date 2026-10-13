<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #192

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/192
- 캡처: 2026-10-13

---
## 배경
- `bash agents/harness/evals/checks.sh`의 Expo Doctor가 FAIL (develop 선존재)
  - `apps/mobile`의 `jest-expo` `~57.0.5` → Expo SDK 57 기대 `~57.0.6`

## 할 일
- `apps/mobile/package.json`의 `jest-expo`를 `~57.0.6`으로 정렬 + pnpm-lock 갱신
  - `npx expo install --check` 또는 `pnpm --filter mobile add -D jest-expo@~57.0.6`

## 비목표
- expo-doctor `userInterfaceStyle` 경고는 이번 범위 밖(app config, 별도)

## Acceptance
- [ ] jest-expo `~57.0.6` 정렬 + lock 갱신
- [ ] `checks.sh` ALL PASS (Expo Doctor 포함)
