// 토큰 진입점 — TS/Skia 등 className 이 아닌 소비자용(예: Skia 하이라이트 hex 색).
// NativeWind className 소비자는 tailwind-preset.js 를 통해 쓴다.
const { cobalt, neutral, red, amber, green } = require("./primitives.js");
const semantic = require("./semantic.js");
const { fontFamily, fontSize, fontWeight, lineHeight, radius } = require("./typography.js");
const { ROLES, cssVarName, cssVars } = require("./theme-vars.js");
const { color } = require("./color.js");
const shadow = require("./shadow.js");

module.exports = {
  cobalt,
  neutral,
  red,
  amber,
  green,
  semantic, // { light, dark }
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  // 테마 경로(0031): 색 prop 리졸버 + vars() 공급 맵.
  color, // color("text") → 현재 테마 hex (Icon·SVG 등 색 prop 단일 지점)
  ROLES,
  cssVarName,
  cssVars, // cssVars("light") → { "--cl-...": hex } (루트 vars() 입력)
  shadow, // { card: { ios, android } } — 그림자 디자인 값(ui 어댑터가 플랫폼 변환)
};
