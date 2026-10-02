/**
 * 공유 Jest 프리셋 — Node + ts-jest 단위 테스트(api·worker·contracts 공통).
 * 소비처는 `preset: require.resolve("@clause-lens/config/jest-preset")` 또는
 * `require("../../packages/config/jest-preset")` 스프레드로 소비하고,
 * `rootDir`(= "src")처럼 패키지마다 다른 값만 각 jest.config.js에 남긴다.
 *
 * transform의 `<rootDir>/../tsconfig.spec.json` 토큰은 소비처의 최종 rootDir
 * 기준으로 Jest가 해석하므로(= 각 패키지의 tsconfig.spec.json) 프리셋에 올려도 동치.
 *
 * mobile(apps/mobile)은 RN(jest-expo) 프리셋이라 이 프리셋을 쓰지 않는다.
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/../tsconfig.spec.json" }],
  },
  testEnvironment: "node",
  // 각 테스트 전 호출기록 + 구현까지 초기화(mobile과 통일, mock 누수 방지).
  resetMocks: true,
};
