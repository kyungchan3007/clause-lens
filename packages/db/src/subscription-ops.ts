// 구독 권한·월 쿼터 판정 — 순수 함수(DB·시계 비의존, now 주입). TASK-006 #162.
// 설계: ADR-12. 보관 권한 = 유효 구독(active|grace), 분석 월 쿼터 = 캘린더월(UTC) 리셋.
// 실제 구독 행 생성·검증은 결제 연동(#165) — 이 모듈은 판정 로직만.

export const SUBSCRIPTION_MONTHLY_QUOTA = 50;

export type SubscriptionStatus = "active" | "grace" | "expired";

// 판정에 필요한 최소 구독 형태(DB row의 부분집합).
export interface SubscriptionLike {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
}

// 접수 근거. 접수 당시 고정(실행 중 만료돼도 바뀌지 않음).
export type ChargeSource = "FREE" | "SUBSCRIPTION";

/**
 * 유효 구독인가 — 보관 권한·분석 월 쿼터의 전제.
 * - active: 기간이 아직 남아있어야 유효(status가 stale일 때 방어).
 * - grace: 결제 유예 — 접근 유지(공급자 관리). (ADR-06 삭제 유예 30일과는 별개)
 * - expired: 무효.
 */
export function isEffectivelyActive(sub: SubscriptionLike, now: Date): boolean {
  if (sub.status === "active") return sub.currentPeriodEnd.getTime() > now.getTime();
  return sub.status === "grace";
}

/** 장기 보관(저장) 권한 — 유효 구독이 하나라도 있으면 true. */
export function canSaveDocuments(subs: readonly SubscriptionLike[], now: Date): boolean {
  return subs.some((s) => isEffectivelyActive(s, now));
}

/** 월 쿼터 리셋 기준 — 현재 UTC 캘린더월 1일 00:00:00. (타임존 미세조정은 후속 config) */
export function monthWindowStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** 이번 달 구독 분석 잔여 — 월 쿼터에서 window 내 사용량(reserved+consumed 건수)을 뺀 값. */
export function subscriptionQuotaRemaining(usedInWindow: number): number {
  return Math.max(0, SUBSCRIPTION_MONTHLY_QUOTA - usedInWindow);
}
