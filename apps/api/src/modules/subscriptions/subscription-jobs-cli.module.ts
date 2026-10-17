import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DbModule } from "../../db/db.module";
import { SubscriptionReconcileService } from "./subscription-reconcile.service";
import { SubscriptionRetryService } from "./subscription-retry.service";
import { SubscriptionsModule } from "./subscriptions.module";

// 재시도·대사 잡(#165 Slice 3) 전용 CLI 부트스트랩 모듈.
// AppModule(앱 서버)에는 이 모듈을 포함하지 않는다 → 런타임·엔드포인트·스케줄러에서 잡 서비스가
// 주입·호출될 수 없음(standalone-only, retention-sweep 패턴). 스크립트만 이 모듈을 부트스트랩.
// SubscriptionsModule에서 실 BILLING_PROVIDER·SUBSCRIPTION_SYNC_ENVIRONMENT·SubscriptionSyncService 재사용.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, SubscriptionsModule],
  providers: [SubscriptionRetryService, SubscriptionReconcileService],
})
export class SubscriptionJobsCliModule {}
