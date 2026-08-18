// 토큰 진입점 — TS/Skia 등 className 이 아닌 소비자용(예: Skia 하이라이트 hex 색).
// NativeWind className 소비자는 tailwind-preset.js 를 통해 쓴다.
const { cobalt, neutral, red, amber, green } = require("./primitives.js");
const semantic = require("./semantic.js");
const { fontFamily, fontSize, fontWeight, lineHeight, radius } = require("./typography.js");

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
};
