// NativeWind/Tailwind preset — 토큰을 tailwind theme 으로 노출.
// F3 에서 앱 tailwind.config.js 가:  presets: [require("@clause-lens/tokens/tailwind-preset")]
// 0031: semantic 색은 `var(--cl-*)` 참조 → 루트 vars(cssVars("light"))가 값 공급(다크=변수 스왑 1곳).
//       primitive 팔레트만 hex. 색 prop(Icon·SVG)은 color() 리졸버 사용.
const { cobalt, neutral, red, amber, green } = require("./primitives.js");
const { fontFamily, fontSize, fontWeight, lineHeight, radius } = require("./typography.js");
const { cssVarName } = require("./theme-vars.js");

const px = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "number" ? `${v}px` : v]));

// semantic 역할 → CSS 변수 참조. 값은 런타임(vars)에서 테마별로 공급.
const v = (role) => `var(${cssVarName(role)})`;

module.exports = {
  theme: {
    extend: {
      colors: {
        // 1층 primitive 접근 (예: text-cobalt-600) — 테마 불변 hex.
        cobalt,
        neutral,
        red,
        amber,
        green,
        // 2층 semantic 별칭(shadcn 관례) — 테마 변수 참조.
        primary: {
          DEFAULT: v("primary"),
          pressed: v("primaryPressed"),
          foreground: v("primaryFg"),
          tint: v("tint"),
        },
        background: v("bg"),
        surface: { DEFAULT: v("surface"), alt: v("surfaceAlt"), subtle: v("neutralBg") },
        foreground: {
          DEFAULT: v("text"),
          muted: v("textMuted"),
          inverse: v("textInverse"),
          subtle: v("neutralText"),
        },
        border: { DEFAULT: v("border"), strong: v("borderStrong") },
        // 배지: 텍스트(text, 700대 대비)와 점/강조(DEFAULT, 600)·배경(bg, 50) 분리.
        danger: { DEFAULT: v("danger"), foreground: neutral[0], bg: v("dangerBg"), text: v("dangerText") },
        warning: { DEFAULT: v("warning"), bg: v("warningBg"), text: v("warningText") },
        success: { DEFAULT: v("success"), bg: v("successBg"), text: v("successText") },
        focus: v("focus"),
      },
      borderRadius: px(radius),
      fontFamily: { sans: fontFamily.sans, mono: fontFamily.mono },
      fontSize: px(fontSize),
      fontWeight, // regular/medium/semibold/bold (medium·semibold·bold은 tailwind 기본과 동일)
      lineHeight, // tight/normal/relaxed
    },
  },
};
