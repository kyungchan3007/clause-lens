import type { ClauseRiskLevel, ClauseType } from "@clause-lens/contracts";

// 위험도 도메인 매핑(0031) — 서버 위험도(ClauseRiskLevel)를 표현용 tone·라벨·아이콘으로.
// hex를 반환하지 않는다: 색은 소비자가 tone → 토큰(color()/className)으로 해석(테마·SVG 재해석 가능).
// result·documents가 공용으로 사용(기능 간 직접 참조 금지 → entities 레이어).

export type Tone = "danger" | "warning" | "success" | "neutral";

export function riskTone(level: ClauseRiskLevel): Tone {
  switch (level) {
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "success";
    default:
      return "neutral";
  }
}

const RISK_LABEL: Record<ClauseRiskLevel, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};
export function riskLabel(level: ClauseRiskLevel): string {
  return RISK_LABEL[level];
}

const RISK_ICON: Record<ClauseRiskLevel, string> = {
  high: "TriangleAlert",
  medium: "AlertCircle",
  low: "Info",
};
export function riskIcon(level: ClauseRiskLevel): string {
  return RISK_ICON[level];
}

// 조항 종류(분류 코드) → 한국어 라벨. 도메인 어휘라 entities에 둔다.
export const clauseTypeLabel: Record<ClauseType, string> = {
  auto_renewal: "자동연장",
  penalty: "위약금",
  termination_restriction: "해지·환불 제한",
  liability: "과도한 책임·면책",
  unilateral_change: "일방적 변경",
  auto_payment: "자동결제",
  privacy_broad: "광범위 개인정보 수집·제공",
  jurisdiction: "관할·중재 강제",
  other: "기타",
};
