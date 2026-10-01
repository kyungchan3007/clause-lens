// 테마 경로(0031) — semantic 색을 NativeWind vars()용 CSS 변수로 공급.
// preset은 `var(--cl-*)`를 참조하고, 앱 루트가 vars(cssVars("light"))로 값을 공급한다.
// 다크 전환 = 루트에서 cssVars("dark")로 스왑(변경 1곳).
const semantic = require("./semantic.js");

// semantic 역할 이름(light·dark 동일 키). preset/리졸버/테스트가 공유하는 단일 소스.
const ROLES = Object.keys(semantic.light);

// camelCase 역할 → --cl-kebab-case 변수명.
function cssVarName(role) {
  return `--cl-${role.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

// 테마의 모든 역할을 { "--cl-...": hex } 로. vars() 입력·누락 검증용.
function cssVars(themeName) {
  const theme = semantic[themeName];
  if (!theme) throw new Error(`unknown theme: ${themeName}`);
  const out = {};
  for (const role of ROLES) out[cssVarName(role)] = theme[role];
  return out;
}

module.exports = { ROLES, cssVarName, cssVars };
