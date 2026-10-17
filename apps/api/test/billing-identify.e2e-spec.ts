import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { DbModule } from "../src/db/db.module";
import { PrismaService } from "../src/db/prisma.service";
import { BillingIdentifyService } from "../src/modules/billing/billing-identify.service";
import {
  BILLING_PROVIDER,
  type BillingProviderPort,
  type ProviderQueryResult,
} from "../src/modules/subscriptions/billing-provider.port";
import { SUBSCRIPTION_SYNC_ENVIRONMENT } from "../src/modules/subscriptions/subscription-sync.service";
import { SubscriptionsModule } from "../src/modules/subscriptions/subscriptions.module";

// identify e2e(#165 Slice 4A) — 실 Postgres + Nest DI + Fake 공급자. 컨트롤러/가드는 단위 커버.
// 서비스 레벨로 매핑 영속·멱등·재동기화(매핑 전 구독 흡수)를 검증. scripts/db-e2e.sh.

const USER = "e2e_identify_user";
const EXT = `${USER}:clauselens_pro`;

class MapProvider implements BillingProviderPort {
  result: ProviderQueryResult = { ok: true, subscriptions: [] };
  async getSubscriberState(): Promise<ProviderQueryResult> {
    return this.result;
  }
}

describe("identify e2e (실 DB)", () => {
  let prisma: PrismaService;
  let identify: BillingIdentifyService;
  const provider = new MapProvider();

  async function cleanup(): Promise<void> {
    await prisma.subscription.deleteMany({ where: { externalId: EXT } });
    await prisma.user.deleteMany({ where: { id: USER } }); // cascade: billingCustomer
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, SubscriptionsModule],
      providers: [BillingIdentifyService],
    })
      .overrideProvider(BILLING_PROVIDER)
      .useValue(provider)
      .overrideProvider(SUBSCRIPTION_SYNC_ENVIRONMENT)
      .useValue("production")
      .compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    identify = moduleRef.get(BillingIdentifyService);
  });

  beforeEach(async () => {
    await cleanup();
    await prisma.user.create({ data: { id: USER, provider: "KAKAO", providerUserId: "e2e_identify_kakao" } });
    provider.result = { ok: true, subscriptions: [] };
  });
  afterAll(async () => {
    if (prisma) {
      await cleanup();
      await prisma.$disconnect();
    }
  });

  it("신규 → 매핑 생성(customerId=userId) 영속", async () => {
    const r = await identify.identify(USER, new Date());
    expect(r.mappingCreated).toBe(true);
    expect(r.customerId).toBe(USER);
    const row = await prisma.billingCustomer.findUnique({
      where: { provider_customerId: { provider: "REVENUECAT", customerId: USER } },
    });
    expect(row?.userId).toBe(USER);
  });

  it("두 번째 호출 → 멱등(mappingCreated=false, 행 1개)", async () => {
    await identify.identify(USER, new Date());
    const r = await identify.identify(USER, new Date());
    expect(r.mappingCreated).toBe(false);
    const count = await prisma.billingCustomer.count({ where: { userId: USER } });
    expect(count).toBe(1);
  });

  it("매핑 전 도착한 구독 → identify 재동기화로 흡수(active 영속)", async () => {
    provider.result = {
      ok: true,
      subscriptions: [
        {
          platform: "PLAY",
          productId: "clauselens_pro",
          period: "MONTHLY",
          externalId: EXT,
          status: "active",
          currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z"),
          gracePeriodEnd: null,
          autoRenew: true,
          environment: "production",
        },
      ],
    };
    const r = await identify.identify(USER, new Date());
    expect(r.synced.outcome).toBe("applied");
    expect(r.synced.applied).toBe(1);
    const sub = await prisma.subscription.findUnique({
      where: { platform_externalId: { platform: "PLAY", externalId: EXT } },
    });
    expect(sub?.status).toBe("active");
    expect(sub?.userId).toBe(USER);
  });
});
