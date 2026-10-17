// 구독 권한·월 쿼터 판정 — 순수 함수(DB·시계 비의존, now 주입). TASK-006 #162.
// 설계: ADR-12. 보관 권한 = 유효 구독(active|grace), 분석 월 쿼터 = 캘린더월(UTC) 리셋.
// 실제 구독 행 생성·검증은 결제 연동(#165) — 이 모듈은 판정 로직만.

export const SUBSCRIPTION_MONTHLY_QUOTA = 50;

export type SubscriptionStatus = "active" | "grace" | "expired";

// 판정에 필요한 최소 구독 형태(DB row의 부분집합).
export interface SubscriptionLike {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  // grace 유예 종료(#165). grace는 이 시각 전까지만 유효. active/expired는 null.
  gracePeriodEnd?: Date | null;
}

// 접수 근거. 접수 당시 고정(실행 중 만료돼도 바뀌지 않음).
export type ChargeSource = "FREE" | "SUBSCRIPTION";

/**
 * 유효 구독인가 — 보관 권한·분석 월 쿼터의 전제.
 * - active: 기간이 아직 남아있어야 유효(status가 stale일 때 방어).
 * - grace: 결제 유예 — **gracePeriodEnd 전까지만** 유효(#165). 기한 없거나 경과면 무효
 *   (만료 알림 누락 시 권한이 영원히 유지되던 버그 방지). (ADR-06 삭제 유예 30일과는 별개)
 * - expired: 무효.
 */
export function isEffectivelyActive(sub: SubscriptionLike, now: Date): boolean {
  if (sub.status === "active") return sub.currentPeriodEnd.getTime() > now.getTime();
  if (sub.status === "grace") {
    return sub.gracePeriodEnd != null && sub.gracePeriodEnd.getTime() > now.getTime();
  }
  return false;
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

// ── 결제 동기화 순수 로직 (#165 Slice 1) ──────────────────────
// 설계: ADR-12 + Codex 2026-10-15. "웹훅=재조회 트리거, 행=검증된 현재 상태의 투영."

export type SubscriptionPlatform = "APP_STORE" | "PLAY" | "TEST";
export type SubscriptionPeriod = "MONTHLY" | "YEARLY";

// 공급자 재조회로 얻은 "검증된 현재 상태" 스냅샷. SDK/공급자 원형은 어댑터(Slice 2)가 이 형태로 변환.
export interface ProviderSubscriptionSnapshot {
  platform: SubscriptionPlatform;
  productId: string;
  period: SubscriptionPeriod;
  externalId: string; // 구독 계보 식별자(갱신별 거래 id 아님)
  status: SubscriptionStatus; // 공급자 해석 현재 상태
  currentPeriodEnd: Date; // 결제 기간 종료
  gracePeriodEnd: Date | null; // grace일 때 유예 종료
  autoRenew: boolean;
  environment: "production" | "sandbox";
}

// Subscription 행에 쓸 필드(스냅샷의 투영). id·userId·verifiedAt은 호출측이 결합.
export interface SubscriptionWrite {
  platform: SubscriptionPlatform;
  productId: string;
  period: SubscriptionPeriod;
  externalId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  gracePeriodEnd: Date | null;
  autoRenew: boolean;
}

/**
 * 공급자 스냅샷 → Subscription 쓰기 필드. 이벤트 맹목 대입이 아니라 "검증된 현재 상태"를 정규화한다.
 * - grace: gracePeriodEnd가 미래여야 유지, 아니면 expired로 강등.
 * - active: 기간이 이미 지났으면(공급자 stale) expired로 강등.
 * - grace가 아니면 gracePeriodEnd는 비운다.
 */
export function normalizeProviderSnapshot(s: ProviderSubscriptionSnapshot, now: Date): SubscriptionWrite {
  let status: SubscriptionStatus = s.status;
  if (status === "grace" && (s.gracePeriodEnd == null || s.gracePeriodEnd.getTime() <= now.getTime())) {
    status = "expired";
  }
  if (status === "active" && s.currentPeriodEnd.getTime() <= now.getTime()) {
    status = "expired";
  }
  return {
    platform: s.platform,
    productId: s.productId,
    period: s.period,
    externalId: s.externalId,
    status,
    currentPeriodEnd: s.currentPeriodEnd,
    gracePeriodEnd: status === "grace" ? s.gracePeriodEnd : null,
    autoRenew: s.autoRenew,
  };
}

export type OwnershipResolution = "ok" | "conflict";

/**
 * 소유권 판정 — 같은 (platform, externalId) 구독이 다른 사용자에게 귀속되려 하면 충돌.
 * 자동 이관·계정 병합 금지(거부 + 충돌 기록). 유니크 제약은 마지막 방어선일 뿐.
 */
export function resolveOwnership(
  existing: { userId: string } | null,
  incomingUserId: string,
): OwnershipResolution {
  if (existing == null) return "ok";
  return existing.userId === incomingUserId ? "ok" : "conflict";
}

/**
 * 늦은(stale) 쓰기 차단 — 펜싱. 공급자 재조회를 queryStartedAt에 시작했는데,
 * 그 사이 더 최신 동기화가 이미 썼다면(기존 verifiedAt > queryStartedAt) 이 쓰기는 버린다.
 * (이벤트 타임스탬프/순서로 보장하지 않고, 재조회 시점 기준으로 직렬화.)
 */
export function isStaleWrite(existing: { verifiedAt: Date } | null, queryStartedAt: Date): boolean {
  if (existing == null) return false;
  return existing.verifiedAt.getTime() > queryStartedAt.getTime();
}

// ── RevenueCat 응답 매핑 보조 순수함수 (#165 Slice 2) ──────────────────────
// 어댑터가 공급자 응답을 ProviderSubscriptionSnapshot로 변환할 때 쓰는 결정 로직(순수·테스트 용이).

/**
 * RevenueCat `store` 문자열 → 내부 플랫폼. **지원 밖(amazon·stripe·promotional 등)은 null**
 * (해당 snapshot skip — 알 수 없는 store를 TEST 등으로 강제 변환해 잘못된 데이터 생성 금지).
 */
export function storeToPlatform(store: string | null | undefined): SubscriptionPlatform | null {
  switch (store) {
    case "app_store":
    case "mac_app_store":
      return "APP_STORE";
    case "play_store":
      return "PLAY";
    default:
      return null;
  }
}

/**
 * 만료·유예 날짜로 현재 상태 판정 — **active 우선 → 만료 후 유효 grace → expired**.
 * - expiresAt 없거나 잘못된 날짜면 null(모델 불가 → snapshot skip, currentPeriodEnd 필수).
 * - active: expiresAt가 미래. grace: expiresAt는 지났고 graceExpiresAt가 미래. 그 외 expired.
 */
export function deriveSubscriptionStatus(
  expiresAt: Date | null,
  graceExpiresAt: Date | null,
  now: Date,
): SubscriptionStatus | null {
  if (expiresAt == null || Number.isNaN(expiresAt.getTime())) return null;
  if (expiresAt.getTime() > now.getTime()) return "active";
  if (
    graceExpiresAt != null &&
    !Number.isNaN(graceExpiresAt.getTime()) &&
    graceExpiresAt.getTime() > now.getTime()
  ) {
    return "grace";
  }
  return "expired";
}
