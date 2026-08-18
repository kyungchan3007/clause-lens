// Metro 모노레포 + NativeWind 설정.
// 모노레포: https://docs.expo.dev/guides/monorepos/  ·  NativeWind: withNativeWind
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1) 모노레포 전체 감시 (workspace 패키지 변경 감지)
config.watchFolders = [monorepoRoot];

// 2) 앱 로컬 → 루트(호이스팅) 순으로 node_modules 해석
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3) NativeWind: global.css 를 tailwind 진입점으로
module.exports = withNativeWind(config, { input: "./global.css" });
