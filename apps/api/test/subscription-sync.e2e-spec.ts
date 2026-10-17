import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { DbModule } from "../src/db/db.module";
import { PrismaService } from "../src/db/prisma.service";
import {
  BILLING_PROVIDER,
  type BillingProviderPort,
  type ProviderQueryResult,
} from "../src/modules/subscriptions/billing-provider.port";
import {
  SubscriptionSyncService,
  type IncomingSubscriptionEvent,
} from "../src/modules/subscriptions/subscription-sync.service";
import { SubscriptionsModule } from "../src/modules/subscriptions/subscriptions.module";

// 통합 e2e — Nest 모듈 부팅 + 실 PrismaService + 실 Postgres.
// 서버 올려서(모듈 DI) 실제 DB에 수신함·구독 행이 정상 영속되는지(수기 마이그레이션 포함) 검증.
// 운영 웹훅 HTTP 라우트는 Slice 2 — 그 e2e는 그때. 공급자 재조회는 Fake로 주입.
// 실행: scripts/db-e2e.sh (임시 Postgres 5433 기동 → migrate → 이 테스트 → 정리).

const NOW = new Date("2026-10-15T00:00:00.000Z");
const PROJECT = "e2e_proj";
const USER = "e2e_sub_user";
const CUSTOMER = "e2e_cust";
const EXT = "e2e_ext_1";

class FakeProvider implements BillingProviderPort {
  result: ProviderQueryResult = { ok: true, subscriptions: [] };
  async getSubscriberState(): Promise<ProviderQueryResult> {
    return this.result;
  }
}

const snapshot = (over: Record<string, unknown> = {}) => ({
  platform: "PLAY" as const,
  productId: "clauselens_pro",
  period: "MONTHLY" as const,
  externalId: EXT,
  status: "active" as const,
  currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
  gracePeriodEnd: null,
  autoRenew: true,
  environment: "production" as const,
  ...over,
});

const evt = (over: Partial<IncomingSubscriptionEvent> = {}): IncomingSubscriptionEvent => ({
  provider: "REVENUECAT",
  projectId: PROJECT,
  eventId: "e2e_e1",
  type: "INITIAL_PURCHASE",
  environment: "production",
  occurredAt: NOW,
  customerId: CUSTOMER,
  payload: {},
  ...over,
});

describe("구독 동기화 e2e (실 DB + Nest 모듈)", () => {
  let prisma: PrismaService;
  let service: SubscriptionSyncService;
  const fake = new FakeProvider();

  async function cleanup(): Promise<void> {
    await prisma.subscriptionEvent.deleteMany({ where: { projectId: PROJECT } });
    await prisma.subscription.deleteMany({ where: { externalId: EXT } });
    await prisma.user.deleteMany({ where: { id: USER } }); // cascade: billingCustomer
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, SubscriptionsModule],
    })
      .overrideProvider(BILLING_PROVIDER)
      .useValue(fake)
      .compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(SubscriptionSyncService);

    await cleanup();
    await prisma.user.create({ data: { id: USER, provider: "KAKAO", providerUserId: "e2e_kakao" } });
    await prisma.billingCustomer.create({
      data: { userId: USER, provider: "REVENUECAT", customerId: CUSTOMER },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
      await prisma.$disconnect();
    }
  });

  it("정상 이벤트 → Subscription active 영속 + 수신함 processed", async () => {
    fake.result = { ok: true, subscriptions: [snapshot()] };
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("applied");

    const sub = await prisma.subscription.findUnique({
      where: { platform_externalId: { platform: "PLAY", externalId: EXT } },
    });
    expect(sub?.status).toBe("active");
    expect(sub?.userId).toBe(USER);

    const ev = await prisma.subscriptionEvent.findUnique({
      where: { provider_projectId_eventId: { provider: "REVENUECAT", projectId: PROJECT, eventId: "e2e_e1" } },
    });
    expect(ev?.status).toBe("processed");
  });

  it("같은 이벤트 재전송 → duplicate (멱등)", async () => {
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("duplicate");
    const count = await prisma.subscriptionEvent.count({ where: { projectId: PROJECT, eventId: "e2e_e1" } });
    expect(count).toBe(1);
  });

  it("유예 만료 스냅샷(gracePeriodEnd 과거) → expired로 투영", async () => {
    fake.result = {
      ok: true,
      subscriptions: [
        snapshot({
          status: "grace",
          currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
          gracePeriodEnd: new Date("2026-10-10T00:00:00.000Z"),
          autoRenew: false,
        }),
      ],
    };
    const r = await service.processEvent(evt({ eventId: "e2e_e2" }), NOW);
    expect(r.outcome).toBe("applied");
    const sub = await prisma.subscription.findUnique({
      where: { platform_externalId: { platform: "PLAY", externalId: EXT } },
    });
    expect(sub?.status).toBe("expired");
    expect(sub?.gracePeriodEnd).toBeNull();
  });

  it("공급자 재조회 실패 → provider_error (기존 상태 유지)", async () => {
    fake.result = { ok: false, errorCode: "upstream_down" };
    const r = await service.processEvent(evt({ eventId: "e2e_e3" }), NOW);
    expect(r.outcome).toBe("provider_error");
    const sub = await prisma.subscription.findUnique({
      where: { platform_externalId: { platform: "PLAY", externalId: EXT } },
    });
    expect(sub?.status).toBe("expired"); // 직전 상태 그대로(안 덮음)
  });
});
