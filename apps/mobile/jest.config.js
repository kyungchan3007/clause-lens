/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  // 각 테스트 전 mock 호출기록 + 구현까지 초기화(구현 누수 방지).
  resetMocks: true,
  // pnpm(.pnpm)은 스코프 패키지를 `@scope+name@ver`로 인코딩 → .pnpm 경로 기준으로
  // RN/Expo/네이티브 계열을 트랜스파일 대상에 포함(그 외 node_modules는 무시).
  transformIgnorePatterns: [
    "node_modules/.pnpm/(?!(jest-)?(@?react-native|expo|@expo|nativewind|zustand|lucide-react-native|@shopify\\+react-native-skia|@clause-lens))",
  ],
};
