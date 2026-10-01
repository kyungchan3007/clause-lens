import { color } from "@clause-lens/tokens";
import type { ClauseRiskLevel } from "@clause-lens/contracts";

import { riskIcon, riskLabel, riskTone, type Tone } from "../../../entities/clause";

// 위험도 표현(feature) = 도메인 매핑(entities) + 토큰 색 해석(tokens color 리졸버).
// 색은 semantic.light를 직접 집지 않고 color()로 해석(0031). 텍스트(대비 700)와
// 하이라이트 강조(600)를 분리한다(같은 tone, 다른 최종 색 — Codex).

export interface RiskPresentation {
  label: string;
  tone: Tone; // 배지(공용 Badge)용 — 색은 tone이 결정(ui)
  color: string; // (하위호환) 배지 텍스트·아이콘(대비 700대)
  accentColor: string; // 이미지 하이라이트 강조(600)
  backgroundColor: string; // 배지 배경(50)
  icon: string;
}

const TONE_TEXT = { danger: "dangerText", warning: "warningText", success: "successText", neutral: "textMuted" } as const;
const TONE_ACCENT = { danger: "danger", warning: "warning", success: "success", neutral: "textMuted" } as const;
const TONE_BG = { danger: "dangerBg", warning: "warningBg", success: "successBg", neutral: "surfaceAlt" } as const;

function present(level: ClauseRiskLevel): RiskPresentation {
  const tone: Tone = riskTone(level);
  return {
    label: riskLabel(level),
    tone,
    color: color(TONE_TEXT[tone]),
    accentColor: color(TONE_ACCENT[tone]),
    backgroundColor: color(TONE_BG[tone]),
    icon: riskIcon(level),
  };
}

export const riskPresentation: Record<ClauseRiskLevel, RiskPresentation> = {
  high: present("high"),
  medium: present("medium"),
  low: present("low"),
};

// 조항 종류 라벨은 도메인(entities)에서 재노출(기존 import 경로 호환).
export { clauseTypeLabel } from "../../../entities/clause";
