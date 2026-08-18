// NativeWind/Tailwind preset — 토큰을 tailwind theme 으로 노출.
// F3 에서 앱 tailwind.config.js 가:  presets: [require("@clause-lens/tokens/tailwind-preset")]
const { cobalt, neutral, red, amber, green } = require("./primitives.js");
const { light } = require("./semantic.js");
const { fontFamily, fontSize, radius } = require("./typography.js");

const px = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "number" ? `${v}px` : v]));

module.exports = {
  theme: {
    extend: {
      colors: {
        // 1층 primitive 접근 (예: text-cobalt-600)
        cobalt,
        neutral,
        red,
        amber,
        green,
        // 2층 semantic 별칭 (예: bg-primary, text-primary-fg). 라이트 기준.
        // 다크모드 전략(dark: variant vs CSS 변수)은 F3에서 확정.
        primary: {
          DEFAULT: light.primary,
          pressed: light.primaryPressed,
          fg: light.primaryFg,
          tint: light.tint,
        },
        danger: { DEFAULT: light.danger, bg: light.dangerBg },
        warning: { DEFAULT: light.warning, bg: light.warningBg },
        success: { DEFAULT: light.success, bg: light.successBg },
      },
      borderRadius: px(radius),
      fontFamily: { sans: fontFamily.sans, mono: fontFamily.mono },
      fontSize: px(fontSize),
    },
  },
};
