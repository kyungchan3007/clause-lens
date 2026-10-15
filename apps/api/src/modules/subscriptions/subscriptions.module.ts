import { Module } from "@nestjs/common";

import { BILLING_PROVIDER } from "./billing-provider.port";
import { SubscriptionSyncService } from "./subscription-sync.service";
import { UnconfiguredBillingProvider } from "./unconfigured-billing-provider";

// 결제 동기화(#165 Slice 1). 서비스만 — 운영 웹훅 라우트·실 RevenueCat 어댑터는 Slice 2.
// BILLING_PROVIDER는 아직 Unconfigured(호출 시 ok:false). DbModule(PrismaService)은 전역.
@Module({
  providers: [
    SubscriptionSyncService,
    { provide: BILLING_PROVIDER, useClass: UnconfiguredBillingProvider },
  ],
  exports: [SubscriptionSyncService],
})
export class SubscriptionsModule {}
