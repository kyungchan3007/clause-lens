// 재열람 보관 배지·날짜 표기(0030). 서버 retainUntil/completedAt(ISO)만으로 계산 — 앱이 임의 가감 없음.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionBadge {
  label: string; // "N일 후 삭제" | "오늘 만료"
  urgent: boolean; // 하루 미만(강조색)
}

// retainUntil 기준 남은 보관일. 하루 미만이면 "오늘 만료"(urgent).
export function retentionBadge(retainUntilIso: string, now: Date = new Date()): RetentionBadge {
  const diff = new Date(retainUntilIso).getTime() - now.getTime();
  const daysLeft = Math.floor(diff / DAY_MS);
  if (daysLeft <= 0) return { label: "오늘 만료", urgent: true };
  return { label: `${daysLeft}일 후 삭제`, urgent: false };
}

// 완료일 상대 표기: 오늘 · 어제 · M/D (시안 — 시간 미표시).
export function completedAtLabel(completedAtIso: string, now: Date = new Date()): string {
  const d = new Date(completedAtIso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(now) - startOf(d)) / DAY_MS);
  if (dayDiff <= 0) return "오늘";
  if (dayDiff === 1) return "어제";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 위험 집계 → 표시(건수 합 + 최고 severity). severity 없으면 null(중립).
export type RiskSeverity = "high" | "medium" | "low" | null;
export function riskSummary(risk: { high: number; medium: number; low: number }): {
  total: number;
  top: RiskSeverity;
} {
  const total = risk.high + risk.medium + risk.low;
  const top: RiskSeverity =
    risk.high > 0 ? "high" : risk.medium > 0 ? "medium" : risk.low > 0 ? "low" : null;
  return { total, top };
}
