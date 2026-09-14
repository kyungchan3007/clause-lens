#!/usr/bin/env node
// 워크스페이스 전체에서 네이티브 모듈이 "단일 버전"으로만 해석되는지 검증.
// 왜: 네이티브 모듈이 두 버전으로 풀리면 iOS/Android 빌드가 깨진다.
//     apps/mobile의 expo-doctor만으론 앱 디렉토리 기준이라, 여기서 워크스페이스
//     레벨(-r, 전체 깊이)로 실제 resolved 버전을 직접 검사한다.
// 방식: `pnpm list` 결과의 실제 해석 버전을 집계한다(설치 트리 기준).
//       store의 orphan 엔트리(아무도 참조 안 하는 잔여)는 잡지 않는다 —
//       그래서 store 디렉터리 개수 세기보다 신뢰할 수 있다.
// pnpm-workspace.yaml overrides와 이 목록을 함께 유지할 것.

import { execSync } from "node:child_process";

const TARGETS = [
  "react-native",
  "react-native-svg",
  "react-native-worklets",
  "react-native-reanimated",
];

let raw;
try {
  raw = execSync(
    `pnpm list ${TARGETS.join(" ")} -r --depth Infinity --json`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 },
  );
} catch (e) {
  // pnpm list는 매칭이 있어도 종료코드가 0이 아닐 수 있으므로 stdout을 그대로 쓴다.
  raw = e.stdout?.toString() ?? "";
}

let projects;
try {
  projects = JSON.parse(raw);
} catch {
  console.error("  ✗ pnpm list 출력을 파싱하지 못했습니다.");
  process.exit(1);
}

const found = Object.fromEntries(TARGETS.map((t) => [t, new Set()]));
function walk(deps) {
  if (!deps) return;
  for (const [name, info] of Object.entries(deps)) {
    if (found[name] && info.version) found[name].add(info.version);
    if (info.dependencies) walk(info.dependencies);
  }
}
for (const proj of projects) {
  walk(proj.dependencies);
  walk(proj.devDependencies);
}

let fail = false;
for (const t of TARGETS) {
  const versions = [...found[t]];
  if (versions.length > 1) {
    console.error(`  ✗ ${t}: ${versions.length}개 버전 해석됨 → [${versions.join(", ")}]`);
    fail = true;
  } else {
    console.log(`  ✓ ${t}: ${versions[0] ?? "(미설치)"}`);
  }
}

if (fail) {
  console.error("  네이티브 모듈이 여러 버전으로 해석됩니다. pnpm-workspace.yaml overrides와 각 package.json 버전을 정렬하세요.");
  process.exit(1);
}
process.exit(0);
