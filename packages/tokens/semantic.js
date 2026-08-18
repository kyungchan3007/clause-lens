// 3층 토큰 — 2층: semantic(역할)
// 컴포넌트는 "이 토큰"을 쓴다. 다크모드/리브랜딩은 여기 매핑만 교체.
const { cobalt, neutral, red, amber, green } = require("./primitives.js");

const light = {
  primary: cobalt[600],
  primaryPressed: cobalt[700],
  primaryFg: neutral[0],
  tint: cobalt[50],

  bg: neutral[0],
  surface: neutral[0],
  surfaceAlt: neutral[50],

  text: neutral[900],
  textMuted: neutral[500],
  textInverse: neutral[0],

  border: neutral[200],
  borderStrong: neutral[300],

  danger: red[600],
  dangerBg: red[50],
  warning: amber[600],
  warningBg: amber[50],
  success: green[600],
  successBg: green[50],

  focus: cobalt[500],
};

const dark = {
  primary: cobalt[500],
  primaryPressed: cobalt[400],
  primaryFg: neutral[900],
  tint: neutral[800],

  bg: neutral[900],
  surface: neutral[800],
  surfaceAlt: neutral[700],

  text: neutral[50],
  textMuted: neutral[400],
  textInverse: neutral[900],

  border: neutral[700],
  borderStrong: neutral[600],

  danger: red[500],
  dangerBg: "#3F1D1D",
  warning: amber[500],
  warningBg: "#3B2A0A",
  success: green[500],
  successBg: "#0E2A17",

  focus: cobalt[400],
};

module.exports = { light, dark };
