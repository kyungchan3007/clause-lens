import { color } from "@clause-lens/tokens";

// 표현용 tone(0b-1) — 상태/위험도 의미를 "색"으로 옮기는 ui 어휘.
// 도메인(riskTone, entities)과 같은 문자열을 쓰되, ui는 도메인을 import하지 않는다
// (소비자가 tone 문자열을 넘긴다). 정적색=className, 색 prop(Icon·점)=color() hex.
export type Tone = "neutral" | "danger" | "warning" | "success" | "info";

// 배지 등 컨테이너/텍스트 className(0a vars 테마 경로로 해석). 대비: 텍스트는 *Text(700대).
const TONE_CLASSES: Record<Tone, { container: string; text: string }> = {
  neutral: { container: "bg-surface-alt", text: "text-foreground-muted" },
  danger: { container: "bg-danger-bg", text: "text-danger-text" },
  warning: { container: "bg-warning-bg", text: "text-warning-text" },
  success: { container: "bg-success-bg", text: "text-success-text" },
  info: { container: "bg-primary-tint", text: "text-primary" },
};
export function toneClasses(tone: Tone): { container: string; text: string } {
  return TONE_CLASSES[tone];
}

// 아이콘·텍스트 전경색 hex(색 prop용). 배지 글자와 같은 대비색.
const TONE_FG_ROLE = {
  neutral: "textMuted",
  danger: "dangerText",
  warning: "warningText",
  success: "successText",
  info: "primary",
} as const;
export function toneForeground(tone: Tone): string {
  return color(TONE_FG_ROLE[tone]);
}

// 점/강조색 hex(StatusDot 등) — 생생한 600대. 의미는 인접 텍스트로 전달해야 한다.
const TONE_ACCENT_ROLE = {
  neutral: "textMuted",
  danger: "danger",
  warning: "warning",
  success: "success",
  info: "primary",
} as const;
export function toneAccent(tone: Tone): string {
  return color(TONE_ACCENT_ROLE[tone]);
}
