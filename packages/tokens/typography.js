// 타이포·모양 토큰.
// 실제 커스텀 폰트 파일(.ttf) 로딩은 앱(F3+)에서 expo-font로. 여기선 시스템 폰트 별칭 + 스케일만 정의.

const fontFamily = {
  sans: ["System"],
  mono: ["Menlo", "monospace"],
};

// RN 은 unitless(dp) 숫자. tailwind preset 에서 px 문자열로 변환한다.
const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
};

const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
};

const radius = {
  none: 0,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  full: 9999,
};

module.exports = { fontFamily, fontSize, fontWeight, lineHeight, radius };
