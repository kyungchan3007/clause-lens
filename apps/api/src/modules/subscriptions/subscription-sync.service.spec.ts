import type { ProviderSubscriptionSnapshot } from "@clause-lens/db/analysis";

import type { PrismaService } from "../../db/prisma.service";
import type { BillingProviderPort, ProviderQueryResult } from "./billing-provider.port";
import {
  SubscriptionSyncService,
  type IncomingSubscriptionEvent,
} from "./subscription-sync.service";

const NOW = new Date("2026-10-15T00:00:00.000Z");

// ── Fake 공급자 ──
class FakeProvider implements BillingProviderPort {
  constructor(private readonly byCustomer: Map<string, ProviderQueryResult> = new Map()) {}
  set(customerId: string, r: ProviderQueryResult): void {
    this.byCustomer.set(customerId, r);
  }
  async getSubscriberState(customerId: string): Promise<ProviderQueryResult> {
    return this.byCustomer.get(customerId) ?? { ok: true, subscriptions: [] };
  }
}

// ── Fake prisma(인메모리) ──
interface SubRow {
  id: string;
  userId: string;
  verifiedAt: Date;
  status: string;
  platform: string;
  externalId: string;
  [k: string]: unknown;
}
function applyData(row: Record<string, unknown>, data: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && "increment" in (v as object)) {
      row[k] = ((row[k] as number) ?? 0) + (v as { increment: number }).increment;
    } else {
      row[k] = v;
    }
  }
}
function makeFakePrisma(seed: {
  customers?: { provider: string; customerId: string; userId: string }[];
  subs?: SubRow[];
  events?: { provider: string; projectId: string; eventId: string }[];
} = {}) {
  const events = new Map<string, Record<string, unknown>>();
  const customers = new Map<string, { userId: string }>();
  const subs = new Map<string, SubRow>();
  const evKey = (p: string, pr: string, e: string) => `${p}|${pr}|${e}`;
  const subKey = (pl: string, ex: string) => `${pl}|${ex}`;

  for (const c of seed.customers ?? []) customers.set(`${c.provider}|${c.customerId}`, { userId: c.userId });
  for (const s of seed.subs ?? []) subs.set(subKey(s.platform, s.externalId), { ...s });
  for (const e of seed.events ?? [])
    events.set(evKey(e.provider, e.projectId, e.eventId), { id: `pre_${events.size}`, ...e });

  let evSeq = 0;
  const prisma = {
    subscriptionEvent: {
      findUnique: async ({ where }: { where: { provider_projectId_eventId: { provider: string; projectId: string; eventId: string } } }) => {
        const w = where.provider_projectId_eventId;
        return events.get(evKey(w.provider, w.projectId, w.eventId)) ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        evSeq += 1;
        const row = { id: `ev_${evSeq}`, attempts: 0, ...data };
        events.set(evKey(data.provider as string, data.projectId as string, data.eventId as string), row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        for (const r of events.values()) if (r.id === where.id) applyData(r, data);
        return {};
      },
    },
    billingCustomer: {
      findUnique: async ({ where }: { where: { provider_customerId: { provider: string; customerId: string } } }) => {
        const w = where.provider_customerId;
        return customers.get(`${w.provider}|${w.customerId}`) ?? null;
      },
    },
    subscription: {
      findUnique: async ({ where }: { where: { platform_externalId: { platform: string; externalId: string } } }) => {
        const w = where.platform_externalId;
        const r = subs.get(subKey(w.platform, w.externalId));
        return r ? { id: r.id, userId: r.userId, verifiedAt: r.verifiedAt } : null;
      },
      upsert: async ({ where, update, create }: { where: { platform_externalId: { platform: string; externalId: string } }; update: Record<string, unknown>; create: Record<string, unknown> }) => {
        const w = where.platform_externalId;
        const k = subKey(w.platform, w.externalId);
        const ex = subs.get(k);
        if (ex) applyData(ex, update);
        else subs.set(k, { id: `sub_${subs.size + 1}`, ...(create as object) } as SubRow);
        return subs.get(k);
      },
    },
    __subs: subs,
    __events: events,
  };
  return prisma;
}

const activeSnap = (over: Partial<ProviderSubscriptionSnapshot> = {}): ProviderSubscriptionSnapshot => ({
  platform: "PLAY",
  productId: "clauselens_pro",
  period: "MONTHLY",
  externalId: "ext_1",
  status: "active",
  currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
  gracePeriodEnd: null,
  autoRenew: true,
  environment: "production",
  ...over,
});

const evt = (over: Partial<IncomingSubscriptionEvent> = {}): IncomingSubscriptionEvent => ({
  provider: "REVENUECAT",
  projectId: "proj_1",
  eventId: "e1",
  type: "INITIAL_PURCHASE",
  environment: "production",
  occurredAt: NOW,
  customerId: "cust_u1",
  payload: { app_user_id: "cust_u1" },
  ...over,
});

function make(seed?: Parameters<typeof makeFakePrisma>[0]) {
  const prisma = makeFakePrisma(seed);
  const provider = new FakeProvider();
  const service = new SubscriptionSyncService(prisma as unknown as PrismaService, provider);
  return { prisma, provider, service };
}

const U1 = [{ provider: "REVENUECAT", customerId: "cust_u1", userId: "u1" }];

describe("SubscriptionSyncService.processEvent", () => {
  it("중복 이벤트 → duplicate (no-op)", async () => {
    const { service, provider } = make({
      customers: U1,
      events: [{ provider: "REVENUECAT", projectId: "proj_1", eventId: "e1" }],
    });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("duplicate");
    expect(r.applied).toBe(0);
  });

  it("고객 매핑 없음 → unmapped (기록만)", async () => {
    const { service } = make({ customers: [] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("unmapped");
  });

  it("공급자 재조회 실패 → provider_error (기존 유지)", async () => {
    const { service, provider } = make({ customers: U1 });
    provider.set("cust_u1", { ok: false, errorCode: "upstream_down" });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("provider_error");
    expect(r.applied).toBe(0);
  });

  it("정상 → applied + Subscription 생성(active)", async () => {
    const { service, provider, prisma } = make({ customers: U1 });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("applied");
    expect(r.applied).toBe(1);
    expect(prisma.__subs.get("PLAY|ext_1")?.status).toBe("active");
    expect(prisma.__subs.get("PLAY|ext_1")?.userId).toBe("u1");
  });

  it("타 계정 귀속 → conflict (기존 소유자 유지, 반영 X)", async () => {
    const { service, provider, prisma } = make({
      customers: U1,
      subs: [
        { id: "sub_x", userId: "u2", verifiedAt: new Date("2026-10-10T00:00:00Z"), status: "active", platform: "PLAY", externalId: "ext_1" },
      ],
    });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.conflicts).toBe(1);
    expect(r.applied).toBe(0);
    expect(prisma.__subs.get("PLAY|ext_1")?.userId).toBe("u2"); // 자동 이관 금지
  });

  it("stale(조회 시작 이후 더 최신 쓰기) → skippedStale (반영 X)", async () => {
    const { service, provider, prisma } = make({
      customers: U1,
      subs: [
        { id: "sub_x", userId: "u1", verifiedAt: new Date("2026-10-16T00:00:00Z"), status: "active", platform: "PLAY", externalId: "ext_1" },
      ],
    });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap({ status: "expired" })] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.skippedStale).toBe(1);
    expect(r.applied).toBe(0);
    expect(prisma.__subs.get("PLAY|ext_1")?.status).toBe("active"); // 안 덮음
  });

  it("유예 만료(gracePeriodEnd 과거) → expired로 투영", async () => {
    const { service, provider, prisma } = make({ customers: U1 });
    provider.set("cust_u1", {
      ok: true,
      subscriptions: [activeSnap({ status: "grace", gracePeriodEnd: new Date("2026-10-10T00:00:00Z") })],
    });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("applied");
    expect(prisma.__subs.get("PLAY|ext_1")?.status).toBe("expired");
  });
});
