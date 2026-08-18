// Metro 모노레포 설정 — 루트 node_modules와 workspace 패키지를 인식하게 함.
// Expo 모노레포 표준: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1) 모노레포 전체를 감시 (workspace 패키지 변경 감지)
config.watchFolders = [monorepoRoot];

// 2) 앱 로컬 → 루트(호이스팅) 순으로 node_modules 해석
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
