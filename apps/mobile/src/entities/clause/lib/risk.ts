import type { ClauseRiskLevel, ClauseType } from "@clause-lens/contracts";
import type { Tone } from "@clause-lens/ui";

// 위험도 도메인 매핑(0031) — 서버 위험도(ClauseRiskLevel)를 표현용 tone·라벨·아이콘으로.
// hex를 반환하지 않는다: 색은 소비자가 tone → 토큰(color()/className)으로 해석(테마·SVG 재해석 가능).
// result·documents가 공용으로 사용(기능 간 직접 참조 금지 → entities 레이어).

// Tone 단일 출처(#145): 표현용 tone 타입은 ui가 소유, 도메인은 재노출만 한다.
// import type이라 런타임 결합 없음(ui는 여전히 도메인을 import하지 않음). 위험도는 info를 내지 않는다.
export type { Tone };

// severity 미상(null/undefined)도 허용 — 홈/목록 요약(top severity 없음)이 바로 넘길 수 있게.
export function riskTone(level: ClauseRiskLevel | null | undefined): Tone {
  switch (level) {
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      // 저위험도 "플래그된 조항"은 중립(회색). 초록(success)은 '안심/0건' 전용(시안·0045).
      return "neutral";
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
  // 서버가 예기치 않은 값(또는 undefined)을 보내도 UI에 'undefined' 노출 방지.
  return RISK_LABEL[level] ?? "알 수 없음";
}

const RISK_ICON: Record<ClauseRiskLevel, string> = {
  high: "TriangleAlert",
  medium: "AlertCircle",
  low: "Info",
};
export function riskIcon(level: ClauseRiskLevel): string {
  // 미지의 위험도는 중립 아이콘으로 폴백(아이콘 미해석 시 Icon이 null 처리).
  return RISK_ICON[level] ?? "CircleHelp";
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
