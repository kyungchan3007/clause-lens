import { semantic } from "@clause-lens/tokens";

import { toneAccent, toneBackground, toneClasses, toneForeground, type Tone } from "./tone";

const TONES: Tone[] = ["neutral", "danger", "warning", "success", "info"];

describe("toneClasses / toneForeground / toneAccent / toneBackground", () => {
  it("모든 tone이 container·text className과 전경/강조/배경 hex를 반환", () => {
    for (const tone of TONES) {
      const c = toneClasses(tone);
      expect(c.container).toMatch(/^bg-/);
      expect(c.text).toMatch(/^text-/);
      expect(toneForeground(tone)).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(toneAccent(tone)).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(toneBackground(tone)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  // 배경 role 고정(#145) — clausePresentation 로컬 TONE_BG와 1:1 동일해야 동작 불변.
  it("toneBackground가 tone별 배경 role 색을 정확히 해석", () => {
    expect(toneBackground("neutral")).toBe(semantic.light.neutralBg);
    expect(toneBackground("danger")).toBe(semantic.light.dangerBg);
    expect(toneBackground("warning")).toBe(semantic.light.warningBg);
    expect(toneBackground("success")).toBe(semantic.light.successBg);
    expect(toneBackground("info")).toBe(semantic.light.tint);
  });
});

// ── WCAG 2.x 상대 휘도·대비비 (배지 작은 글자는 일반 텍스트 → 4.5:1 이상) ──
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function ratio(a: string, b: string): number {
  const la = luminance(a) + 0.05;
  const lb = luminance(b) + 0.05;
  return la > lb ? la / lb : lb / la;
}

// Badge가 실제로 쓰는 전경(text 역할)·배경(container 역할) 쌍.
const BADGE_PAIR: Record<Tone, [keyof typeof semantic.light, keyof typeof semantic.light]> = {
  neutral: ["neutralText", "neutralBg"],
  danger: ["dangerText", "dangerBg"],
  warning: ["warningText", "warningBg"],
  success: ["successText", "successBg"],
  info: ["primary", "tint"],
};

describe("배지 텍스트 대비 (WCAG ≥ 4.5:1)", () => {
  it.each(TONES)("%s tone 텍스트/배경 대비가 4.5:1 이상", (tone) => {
    const [fg, bg] = BADGE_PAIR[tone];
    const r = ratio(semantic.light[fg], semantic.light[bg]);
    expect(r).toBeGreaterThanOrEqual(4.5);
  });
});
