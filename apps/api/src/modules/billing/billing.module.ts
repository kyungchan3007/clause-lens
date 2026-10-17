import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { BillingController } from "./billing.controller";
import { BillingIdentifyService } from "./billing-identify.service";

// 결제 계정 연결(#165 Slice 4A). AuthModule(JwtAuthGuard) + SubscriptionsModule(SubscriptionSyncService) 재사용.
// SubscriptionsModule에 Auth를 끌어들이지 않으려 별도 모듈(잡 CLI는 Auth 불필요).
@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [BillingController],
  providers: [BillingIdentifyService],
})
export class BillingModule {}
