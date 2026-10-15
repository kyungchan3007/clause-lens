import type { ProviderSubscriptionSnapshot } from "@clause-lens/db/analysis";

// 공급자(RevenueCat) "현재 상태 재조회" 포트. 웹훅·대사·앱sync가 공유하는 단일 경로의 외부 호출 추상화.
// 실제 RevenueCat REST 어댑터는 Slice 2. 이벤트 payload를 맹목 적용하지 않고 "검증된 현재 상태"를 받아온다.
export type ProviderQueryResult =
  | { ok: true; subscriptions: ProviderSubscriptionSnapshot[] }
  | { ok: false; errorCode: string };

export interface BillingProviderPort {
  // 공급자 고객 id(app_user_id)로 현재 구독 상태를 재조회. 실패는 ok:false(권한 유지·미부여).
  getSubscriberState(customerId: string): Promise<ProviderQueryResult>;
}

// DI 토큰. 운영 바인딩(실 어댑터)은 Slice 2, 그 전엔 UnconfiguredBillingProvider.
export const BILLING_PROVIDER = "BILLING_PROVIDER";
