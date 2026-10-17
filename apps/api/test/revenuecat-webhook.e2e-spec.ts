import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHmac } from "node:crypto";

import { DbModule } from "../src/db/db.module";
import { PrismaService } from "../src/db/prisma.service";
import {
  BILLING_PROVIDER,
  type BillingProviderPort,
  type ProviderQueryResult,
} from "../src/modules/subscriptions/billing-provider.port";
import {
  REVENUECAT_WEBHOOK_CONFIG,
  type RevenueCatWebhookConfig,
} from "../src/modules/subscriptions/revenuecat-webhook.guard";
import { REVENUECAT_PROJECT_ID } from "../src/modules/subscriptions/subscriptions.controller";
import { SubscriptionsModule } from "../src/modules/subscriptions/subscriptions.module";
import { SUBSCRIPTION_SYNC_ENVIRONMENT } from "../src/modules/subscriptions/subscription-sync.service";

// 웹훅 HTTP e2e — 실 Postgres + Nest HTTP(rawBody) + 인증(정적+HMAC).
// 공급자 재조회는 Fake(계정 불필요). 실행: scripts/db-e2e.sh.

const AUTH = "e2e-webhook-auth";
const HMAC = "e2e-hmac-secret";
const PROJECT = "e2e_webhook_proj";
const USER = "e2e_wh_user";
const CUSTOMER = "e2e_wh_cust";
const EXT = `${CUSTOMER}:clauselens_pro`;

class FakeProvider implements BillingProviderPort {
  result: ProviderQueryResult = { ok: true, subscriptions: [] };
  async getSubscriberState(): Promise<ProviderQueryResult> {
    return this.result;
  }
}

const activeSnap = {
  platform: "PLAY" as const,
  productId: "clauselens_pro",
  period: "MONTHLY" as const,
  externalId: EXT,
  status: "active" as const,
  currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z"),
  gracePeriodEnd: null,
  autoRenew: true,
  environment: "production" as const,
};

function webhookBody(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    api_version: "1.0",
    event: {
      id: "evt_1",
      type: "INITIAL_PURCHASE",
      app_user_id: CUSTOMER,
      environment: "PRODUCTION",
      event_timestamp_ms: Date.UTC(2026, 9, 15),
      ...over,
    },
  });
}

describe("RevenueCat 웹훅 e2e (실 DB + Nest HTTP)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url: string;
  const fake = new FakeProvider();

  async function cleanup(): Promise<void> {
    await prisma.subscriptionEvent.deleteMany({ where: { projectId: PROJECT } });
    await prisma.subscription.deleteMany({ where: { externalId: EXT } });
    await prisma.user.deleteMany({ where: { id: USER } });
  }

  async function post(
    rawBody: string,
    opts: { authorization?: string | null; signature?: string | null } = {},
  ): Promise<{ status: number; json: unknown }> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.authorization !== null) headers.authorization = opts.authorization ?? AUTH;
    if (opts.signature !== null) {
      const t = Math.floor(Date.now() / 1000);
      const v1 =
        opts.signature ??
        createHmac("sha256", HMAC).update(`${t}.`).update(Buffer.from(rawBody, "utf8")).digest("hex");
      headers["x-revenuecat-webhook-signature"] = `t=${t},v1=${v1}`;
    }
    const res = await fetch(`${url}/billing/revenuecat/webhook`, { method: "POST", headers, body: rawBody });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DbModule, SubscriptionsModule] })
      .overrideProvider(BILLING_PROVIDER)
      .useValue(fake)
      .overrideProvider(REVENUECAT_WEBHOOK_CONFIG)
      .useValue({ authorization: AUTH, hmacSecret: HMAC, toleranceSec: 300 } satisfies RevenueCatWebhookConfig)
      .overrideProvider(SUBSCRIPTION_SYNC_ENVIRONMENT)
      .useValue("production")
      .overrideProvider(REVENUECAT_PROJECT_ID)
      .useValue(PROJECT)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
    await app.listen(0);
    url = (await app.getUrl()).replace("[::1]", "127.0.0.1");
    prisma = moduleRef.get(PrismaService);

    await cleanup();
    await prisma.user.create({ data: { id: USER, provider: "KAKAO", providerUserId: "e2e_wh_kakao" } });
    await prisma.billingCustomer.create({
      data: { userId: USER, provider: "REVENUECAT", customerId: CUSTOMER },
    });
  });

  afterAll(async () => {
    if (prisma) await cleanup();
    if (app) await app.close();
  });

  it("정상 이벤트(인증+HMAC) → 200 applied + 구독 영속 + 수신함 processed", async () => {
    fake.result = { ok: true, subscriptions: [activeSnap] };
    const r = await post(webhookBody());
    expect(r.status).toBe(200);
    expect((r.json as { outcome: string }).outcome).toBe("applied");

    const sub = await prisma.subscription.findUnique({
      where: { platform_externalId: { platform: "PLAY", externalId: EXT } },
    });
    expect(sub?.status).toBe("active");
    expect(sub?.userId).toBe(USER);
    const ev = await prisma.subscriptionEvent.findUnique({
      where: { provider_projectId_eventId: { provider: "REVENUECAT", projectId: PROJECT, eventId: "evt_1" } },
    });
    expect(ev?.status).toBe("processed");
  });

  it("같은 이벤트 재전송 → 200 duplicate (수신함 1건)", async () => {
    const r = await post(webhookBody());
    expect(r.status).toBe(200);
    expect((r.json as { outcome: string }).outcome).toBe("duplicate");
    const count = await prisma.subscriptionEvent.count({ where: { projectId: PROJECT, eventId: "evt_1" } });
    expect(count).toBe(1);
  });

  it("매핑 없는 고객 → 200 unmapped", async () => {
    fake.result = { ok: true, subscriptions: [] };
    const r = await post(webhookBody({ id: "evt_unmapped", app_user_id: "cust_unknown" }));
    expect(r.status).toBe(200);
    expect((r.json as { outcome: string }).outcome).toBe("unmapped");
  });

  it("sandbox 이벤트(운영 서버) → 200 skipped (반영 X)", async () => {
    fake.result = { ok: true, subscriptions: [activeSnap] };
    const r = await post(webhookBody({ id: "evt_sbx", environment: "SANDBOX" }));
    expect(r.status).toBe(200);
    expect((r.json as { outcome: string }).outcome).toBe("skipped");
  });

  it("공급자 재조회 실패 → 503 (RC 재시도 유도)", async () => {
    fake.result = { ok: false, errorCode: "upstream_down" };
    const r = await post(webhookBody({ id: "evt_perr" }));
    expect(r.status).toBe(503);
  });

  it("잘못된 Authorization → 401", async () => {
    const r = await post(webhookBody({ id: "evt_badauth" }), { authorization: "wrong" });
    expect(r.status).toBe(401);
  });

  it("위조 HMAC → 401", async () => {
    const r = await post(webhookBody({ id: "evt_badsig" }), { signature: "deadbeef" });
    expect(r.status).toBe(401);
  });
});
