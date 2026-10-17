import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { DbModule } from "../src/db/db.module";
import { PrismaService } from "../src/db/prisma.service";
import {
  BILLING_PROVIDER,
  type BillingProviderPort,
  type ProviderQueryResult,
} from "../src/modules/subscriptions/billing-provider.port";
import { SubscriptionReconcileService } from "../src/modules/subscriptions/subscription-reconcile.service";
import { SubscriptionRetryService } from "../src/modules/subscriptions/subscription-retry.service";
import { SUBSCRIPTION_SYNC_ENVIRONMENT } from "../src/modules/subscriptions/subscription-sync.service";
import { SubscriptionsModule } from "../src/modules/subscriptions/subscriptions.module";

// 재시도·대사 잡 e2e(#165 Slice 3) — 실 Postgres + Nest DI + Fake 공급자. scripts/db-e2e.sh.

const PROJECT = "e2e_jobs_proj";
const USER = "e2e_jobs_user";
const CUST = "e2e_jobs_cust";
const EXT = `${CUST}:clauselens_pro`;

class MapProvider implements BillingProviderPort {
  byCustomer = new Map<string, ProviderQueryResult>();
  async getSubscriberState(customerId: string): Promise<ProviderQueryResult> {
    return this.byCustomer.get(customerId) ?? { ok: true, subscriptions: [] };
  }
}

const activeSnap = (over: Record<string, unknown> = {}) => ({
  platform: "PLAY" as const,
  productId: "clauselens_pro",
  period: "MONTHLY" as const,
  externalId: EXT,
  status: "active" as const,
  currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z"),
  gracePeriodEnd: null,
  autoRenew: true,
  environment: "production" as const,
  ...over,
});

describe("구독 재시도·대사 잡 e2e (실 DB)", () => {
  let prisma: PrismaService;
  let retry: SubscriptionRetryService;
  let reconcile: SubscriptionReconcileService;
  const provider = new MapProvider();

  async function cleanup(): Promise<void> {
    await prisma.subscriptionEvent.deleteMany({ where: { projectId: PROJECT } });
    await prisma.subscription.deleteMany({ where: { externalId: EXT } });
    await prisma.user.deleteMany({ where: { id: USER } });
  }
  async function seedUser(): Promise<void> {
    await prisma.user.create({ data: { id: USER, provider: "KAKAO", providerUserId: "e2e_jobs_kakao" } });
    await prisma.billingCustomer.create({ data: { userId: USER, provider: "REVENUECAT", customerId: CUST } });
  }
  function failedEvent(eventId: string, attempts: number) {
    return prisma.subscriptionEvent.create({
      data: {
        provider: "REVENUECAT",
        projectId: PROJECT,
        eventId,
        type: "RENEWAL",
        environment: "production",
        occurredAt: new Date("2026-10-15T00:00:00Z"),
        status: "failed",
        attempts,
        nextRetryAt: new Date("2026-10-14T00:00:00Z"), // 과거(기한 도래)
        payload: { event: { app_user_id: CUST } },
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, SubscriptionsModule],
      providers: [SubscriptionRetryService, SubscriptionReconcileService],
    })
      .overrideProvider(BILLING_PROVIDER)
      .useValue(provider)
      .overrideProvider(SUBSCRIPTION_SYNC_ENVIRONMENT)
      .useValue("production")
      .compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    retry = moduleRef.get(SubscriptionRetryService);
    reconcile = moduleRef.get(SubscriptionReconcileService);
  });

  beforeEach(async () => {
    await cleanup();
    await seedUser();
    provider.byCustomer.clear();
  });
  afterAll(async () => {
    if (prisma) {
      await cleanup();
      await prisma.$disconnect();
    }
  });

  it("재시도: failed 이벤트 → processed + 구독 active", async () => {
    await failedEvent("ev_retry", 1);
    provider.byCustomer.set(CUST, { ok: true, subscriptions: [activeSnap()] });
    const r = await retry.execute(new Date(), 50, 500);
    expect(r.succeeded).toBe(1);
    const ev = await prisma.subscriptionEvent.findUnique({
      where: { provider_projectId_eventId: { provider: "REVENUECAT", projectId: PROJECT, eventId: "ev_retry" } },
    });
    expect(ev?.status).toBe("processed");
    const sub = await prisma.subscription.findUnique({
      where: { platform_externalId: { platform: "PLAY", externalId: EXT } },
    });
    expect(sub?.status).toBe("active");
  });

  it("재시도: 공급자 계속 실패 + attempts MAX 도달 → dead", async () => {
    await failedEvent("ev_dead", 7); // MAX=8 → claim 후 8 → dead
    provider.byCustomer.set(CUST, { ok: false, errorCode: "upstream_down" });
    const r = await retry.execute(new Date(), 50, 500);
    expect(r.deadLettered).toBe(1);
    const ev = await prisma.subscriptionEvent.findUnique({
      where: { provider_projectId_eventId: { provider: "REVENUECAT", projectId: PROJECT, eventId: "ev_dead" } },
    });
    expect(ev?.status).toBe("dead");
    expect(ev?.nextRetryAt).toBeNull();
  });

  it("재시도 dry-run → 상태 변경 없음", async () => {
    await failedEvent("ev_dry", 2);
    provider.byCustomer.set(CUST, { ok: true, subscriptions: [activeSnap()] });
    const r = await retry.dryRun(new Date(), 50);
    expect(r.totalCandidates).toBeGreaterThanOrEqual(1);
    const ev = await prisma.subscriptionEvent.findUnique({
      where: { provider_projectId_eventId: { provider: "REVENUECAT", projectId: PROJECT, eventId: "ev_dry" } },
    });
    expect(ev?.status).toBe("failed"); // 무변경
    expect(ev?.attempts).toBe(2);
  });

  it("대사: ok:true → 구독 반영(applied)", async () => {
    provider.byCustomer.set(CUST, { ok: true, subscriptions: [activeSnap()] });
    const r = await reconcile.execute(10);
    expect(r.applied).toBe(1);
    const sub = await prisma.subscription.findUnique({
      where: { platform_externalId: { platform: "PLAY", externalId: EXT } },
    });
    expect(sub?.status).toBe("active");
  });

  it("대사: 공급자 실패 → 기존 구독 유지(강등 없음)", async () => {
    await prisma.subscription.create({
      data: {
        userId: USER,
        platform: "PLAY",
        productId: "clauselens_pro",
        period: "MONTHLY",
        status: "active",
        externalId: EXT,
        currentPeriodEnd: new Date("2099-01-01T00:00:00Z"),
        autoRenew: true,
        verifiedAt: new Date("2026-10-10T00:00:00Z"),
      },
    });
    provider.byCustomer.set(CUST, { ok: false, errorCode: "upstream_down" });
    const r = await reconcile.execute(10);
    expect(r.providerError).toBe(1);
    const sub = await prisma.subscription.findUnique({
      where: { platform_externalId: { platform: "PLAY", externalId: EXT } },
    });
    expect(sub?.status).toBe("active"); // 유지
  });
});
