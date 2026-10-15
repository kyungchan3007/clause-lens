import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SubscriptionPeriod } from "@clause-lens/db/analysis";

import { BILLING_PROVIDER, type BillingProviderPort } from "./billing-provider.port";
import {
  DEFAULT_PRODUCT_PERIODS,
  RevenueCatBillingProvider,
} from "./revenuecat-billing-provider";
import {
  REVENUECAT_WEBHOOK_CONFIG,
  RevenueCatWebhookGuard,
  type RevenueCatWebhookConfig,
} from "./revenuecat-webhook.guard";
import { REVENUECAT_PROJECT_ID, SubscriptionsController } from "./subscriptions.controller";
import {
  SUBSCRIPTION_SYNC_ENVIRONMENT,
  SubscriptionSyncService,
} from "./subscription-sync.service";
import { UnconfiguredBillingProvider } from "./unconfigured-billing-provider";

function resolveEnvironment(config: ConfigService): "production" | "sandbox" {
  return config.get<string>("REVENUECAT_ENVIRONMENT") === "sandbox" ? "sandbox" : "production";
}

function resolveProductPeriods(config: ConfigService): Readonly<Record<string, SubscriptionPeriod>> {
  const raw = config.get<string>("REVENUECAT_PRODUCT_PERIODS");
  if (!raw) return DEFAULT_PRODUCT_PERIODS;
  try {
    return { ...DEFAULT_PRODUCT_PERIODS, ...(JSON.parse(raw) as Record<string, SubscriptionPeriod>) };
  } catch {
    throw new Error("REVENUECAT_PRODUCT_PERIODS 가 올바른 JSON이 아닙니다.");
  }
}

// 운영 활성(실 어댑터) 바인딩. 키 없으면 Unconfigured(개발 안전). 활성 시 필수 설정 검증(조용한 불능 금지).
function billingProviderFactory(config: ConfigService): BillingProviderPort {
  const secretKey = config.get<string>("REVENUECAT_SECRET_KEY");
  if (!secretKey) return new UnconfiguredBillingProvider();

  const authorization = config.get<string>("REVENUECAT_WEBHOOK_AUTHORIZATION");
  const projectId = config.get<string>("REVENUECAT_PROJECT_ID");
  if (!authorization || !projectId) {
    throw new Error(
      "RevenueCat 운영 활성(REVENUECAT_SECRET_KEY)인데 REVENUECAT_WEBHOOK_AUTHORIZATION / REVENUECAT_PROJECT_ID 가 없습니다. 웹훅이 조용히 동기화 불능이 되지 않도록 필수 설정을 주입하세요.",
    );
  }
  return new RevenueCatBillingProvider({
    secretKey,
    apiBase: config.get<string>("REVENUECAT_API_BASE") ?? "https://api.revenuecat.com",
    environment: resolveEnvironment(config),
    timeoutMs: Number(config.get<string>("REVENUECAT_HTTP_TIMEOUT_MS") ?? "8000"),
    productPeriods: resolveProductPeriods(config),
  });
}

function webhookConfigFactory(config: ConfigService): RevenueCatWebhookConfig {
  return {
    authorization: config.get<string>("REVENUECAT_WEBHOOK_AUTHORIZATION") ?? "",
    hmacSecret: config.get<string>("REVENUECAT_WEBHOOK_HMAC_SECRET") || undefined,
    toleranceSec: Number(config.get<string>("REVENUECAT_WEBHOOK_TOLERANCE_SEC") ?? "300"),
  };
}

// 결제 동기화(#165). Slice 2: 실 RevenueCat 어댑터 + 운영 웹훅 라우트 활성. DbModule(PrismaService) 전역.
@Module({
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionSyncService,
    RevenueCatWebhookGuard,
    {
      provide: SUBSCRIPTION_SYNC_ENVIRONMENT,
      useFactory: resolveEnvironment,
      inject: [ConfigService],
    },
    {
      provide: BILLING_PROVIDER,
      useFactory: billingProviderFactory,
      inject: [ConfigService],
    },
    {
      provide: REVENUECAT_WEBHOOK_CONFIG,
      useFactory: webhookConfigFactory,
      inject: [ConfigService],
    },
    {
      provide: REVENUECAT_PROJECT_ID,
      useFactory: (config: ConfigService) => config.get<string>("REVENUECAT_PROJECT_ID") ?? "clause-lens",
      inject: [ConfigService],
    },
  ],
  exports: [SubscriptionSyncService],
})
export class SubscriptionsModule {}
