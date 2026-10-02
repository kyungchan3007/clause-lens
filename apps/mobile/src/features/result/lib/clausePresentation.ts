import type { ClauseRiskLevel } from "@clause-lens/contracts";
import { toneAccent, toneBackground, toneForeground } from "@clause-lens/ui";

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

// tone→색 매핑은 ui 헬퍼(toneForeground/Accent/Background)가 단일 소유(#145).
// 텍스트(대비 700)·강조(600)·배경(50)을 각각 해석 — role 값은 기존 로컬 맵과 1:1 동일.
function present(level: ClauseRiskLevel): RiskPresentation {
  const tone: Tone = riskTone(level);
  return {
    label: riskLabel(level),
    tone,
    color: toneForeground(tone),
    accentColor: toneAccent(tone),
    backgroundColor: toneBackground(tone),
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
