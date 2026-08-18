// @clause-lens/tokens 타입 선언. 값은 index.js(및 primitives/semantic/typography.js)가 소스.
type ColorScale = Record<string | number, string>;

export const cobalt: ColorScale;
export const neutral: ColorScale;
export const red: ColorScale;
export const amber: ColorScale;
export const green: ColorScale;

export interface SemanticColors {
  primary: string;
  primaryPressed: string;
  primaryFg: string;
  tint: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderStrong: string;
  danger: string;
  dangerBg: string;
  warning: string;
  warningBg: string;
  success: string;
  successBg: string;
  focus: string;
}

export const semantic: { light: SemanticColors; dark: SemanticColors };

export const fontFamily: Record<string, string[]>;
export const fontSize: Record<string, number>;
export const fontWeight: Record<string, string>;
export const lineHeight: Record<string, number>;
export const radius: Record<string, number>;
