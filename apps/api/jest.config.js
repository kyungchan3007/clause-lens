/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { tsconfig: "<rootDir>/../tsconfig.spec.json" },
    ],
  },
  testEnvironment: "node",
  // 호출기록 + 구현까지 초기화(mobile과 통일, mock 누수 방지).
  resetMocks: true,
};
