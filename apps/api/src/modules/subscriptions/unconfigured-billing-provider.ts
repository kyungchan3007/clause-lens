import { Injectable } from "@nestjs/common";

import type { BillingProviderPort, ProviderQueryResult } from "./billing-provider.port";

// Slice 1: 실 RevenueCat 어댑터는 Slice 2. 그 전까지 운영 결제 경로는 비활성.
// 호출돼도 재조회 실패(ok:false)로 처리 → 기존 구독 상태를 바꾸지 않는다(안전).
@Injectable()
export class UnconfiguredBillingProvider implements BillingProviderPort {
  async getSubscriberState(): Promise<ProviderQueryResult> {
    return { ok: false, errorCode: "billing_provider_not_configured" };
  }
}
