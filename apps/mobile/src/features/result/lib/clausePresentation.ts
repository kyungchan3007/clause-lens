import { semantic } from "@clause-lens/tokens";
import type { ClauseRiskLevel, ClauseType } from "@clause-lens/contracts";

// 위험도·조항 종류의 도메인 표현(라벨·색·아이콘) 매핑. (공용 Badge는 값만 받고, 의미 매핑은 여기)
// 색은 신규 토큰 대신 기존 semantic(danger/warning/success)에 매핑한다.

export interface RiskPresentation {
  label: string;
  color: string;
  backgroundColor: string;
  icon: string;
}

const c = semantic.light;

export const riskPresentation: Record<ClauseRiskLevel, RiskPresentation> = {
  high: { label: "높음", color: c.danger, backgroundColor: c.dangerBg, icon: "TriangleAlert" },
  medium: { label: "보통", color: c.warning, backgroundColor: c.warningBg, icon: "AlertCircle" },
  low: { label: "낮음", color: c.success, backgroundColor: c.successBg, icon: "Info" },
};

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
