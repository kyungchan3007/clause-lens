// 공유 UI 패키지(packages/ui) 단위 테스트 — mobile의 jest-expo 설정을 그대로 재사용(복제 금지).
// rootDir은 apps/mobile 유지(babel·transformIgnore·node_modules 해석을 동작하는 mobile과 동일하게),
// roots만 packages/ui/src로 돌려 거기 테스트를 수집한다.
// 실행: checks.sh 가 `pnpm --filter @clause-lens/mobile exec jest --config jest.ui.config.js`.
const base = require("./jest.config");

module.exports = {
  ...base,
  roots: ["<rootDir>/../../packages/ui/src"],
  // mobile 전용 env 셋업(EXPO_PUBLIC_*)은 ui 테스트에 불필요.
  setupFiles: [],
  // lucide-react-native(ESM)는 단위 테스트에서 더미로 — 실제 아이콘 렌더는 실측 대상.
  moduleNameMapper: {
    ...(base.moduleNameMapper ?? {}),
    "^lucide-react-native$": "<rootDir>/../../packages/ui/test-support/lucide-mock.js",
  },
};
