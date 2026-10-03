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
  neutralBg: string;
  neutralText: string;
  danger: string;
  dangerBg: string;
  dangerText: string;
  warning: string;
  warningBg: string;
  warningText: string;
  success: string;
  successBg: string;
  successText: string;
  focus: string;
}

export const semantic: { light: SemanticColors; dark: SemanticColors };

export const fontFamily: Record<string, string[]>;
export const fontSize: Record<string, number>;
export const fontWeight: Record<string, string>;
export const lineHeight: Record<string, number>;
export const radius: Record<string, number>;

// 테마 경로(0031)
export type SemanticRole = keyof SemanticColors;
export const ROLES: SemanticRole[];
export function cssVarName(role: SemanticRole): string;
export function cssVars(themeName: "light" | "dark"): Record<string, string>;
export function color(role: SemanticRole): string;

// 그림자 디자인 값(ui 어댑터가 플랫폼 변환, 0035)
export interface ShadowSpec {
  ios: { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number } };
  android: { elevation: number };
}
export const shadow: { card: ShadowSpec };
