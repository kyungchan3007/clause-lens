import type { ProviderSubscriptionSnapshot } from "@clause-lens/db/analysis";

import type { PrismaService } from "../../db/prisma.service";
import type { BillingProviderPort, ProviderQueryResult } from "./billing-provider.port";
import {
  computeNextRetry,
  isTerminalStatus,
  SUBSCRIPTION_MAX_ATTEMPTS,
  SubscriptionSyncService,
  type IncomingSubscriptionEvent,
} from "./subscription-sync.service";

const NOW = new Date("2026-10-15T00:00:00.000Z");

class FakeProvider implements BillingProviderPort {
  constructor(private readonly byCustomer: Map<string, ProviderQueryResult> = new Map()) {}
  set(customerId: string, r: ProviderQueryResult): void {
    this.byCustomer.set(customerId, r);
  }
  async getSubscriberState(customerId: string): Promise<ProviderQueryResult> {
    return this.byCustomer.get(customerId) ?? { ok: true, subscriptions: [] };
  }
}

interface EventRow {
  id: string;
  provider: string;
  projectId: string;
  eventId: string;
  type: string;
  environment: string;
  occurredAt: Date;
  status: string;
  attempts: number;
  nextRetryAt: Date | null;
  leaseExpiresAt: Date | null;
  errorCode: string | null;
  processedAt: Date | null;
  payload: unknown;
}
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
    if (v && typeof v === "object" && !(v instanceof Date) && "increment" in (v as object)) {
      row[k] = ((row[k] as number) ?? 0) + (v as { increment: number }).increment;
    } else {
      row[k] = v;
    }
  }
}

// updateMany/claim의 where 모양을 평가하는 작은 matcher.
function matchCond(r: Record<string, unknown>, cond: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(cond)) {
    if (k === "OR") {
      if (!(v as Record<string, unknown>[]).some((c) => matchCond(r, c))) return false;
    } else if (k === "status") {
      if (v && typeof v === "object" && "in" in (v as object)) {
        if (!(v as { in: string[] }).in.includes(r.status as string)) return false;
      } else if (r.status !== v) return false;
    } else if (k === "leaseExpiresAt") {
      const cur = r.leaseExpiresAt as Date | null;
      if (v instanceof Date) {
        if (!cur || cur.getTime() !== v.getTime()) return false;
      } else if (v && typeof v === "object" && "lt" in (v as object)) {
        if (!cur || cur.getTime() >= (v as { lt: Date }).lt.getTime()) return false;
      }
    } else if (r[k] !== v) return false;
  }
  return true;
}

function makeFakePrisma(
  seed: {
    customers?: { provider: string; customerId: string; userId: string }[];
    subs?: SubRow[];
    events?: Partial<EventRow>[];
  } = {},
) {
  const events: EventRow[] = [];
  const customers = new Map<string, { userId: string }>();
  const subs = new Map<string, SubRow>();
  const subKey = (pl: string, ex: string) => `${pl}|${ex}`;

  for (const c of seed.customers ?? []) customers.set(`${c.provider}|${c.customerId}`, { userId: c.userId });
  for (const s of seed.subs ?? []) subs.set(subKey(s.platform, s.externalId), { ...s });
  seed.events?.forEach((e, i) =>
    events.push({
      id: `pre_${i}`,
      provider: "REVENUECAT",
      projectId: "proj_1",
      eventId: "e1",
      type: "INITIAL_PURCHASE",
      environment: "production",
      occurredAt: NOW,
      status: "received",
      attempts: 0,
      nextRetryAt: null,
      leaseExpiresAt: null,
      errorCode: null,
      processedAt: null,
      payload: {},
      ...e,
    }),
  );

  const findEvent = (where: Record<string, unknown>): EventRow | null => {
    if (where.id) return events.find((r) => r.id === where.id) ?? null;
    const k = where.provider_projectId_eventId as { provider: string; projectId: string; eventId: string } | undefined;
    if (k) return events.find((r) => r.provider === k.provider && r.projectId === k.projectId && r.eventId === k.eventId) ?? null;
    return null;
  };

  let evSeq = 0;
  const prisma = {
    subscriptionEvent: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => findEvent(where),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        evSeq += 1;
        const row: EventRow = {
          id: `ev_${evSeq}`,
          attempts: 0,
          nextRetryAt: null,
          leaseExpiresAt: null,
          errorCode: null,
          processedAt: null,
          ...(data as object),
        } as EventRow;
        events.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const r of events) {
          if (matchCond(r as unknown as Record<string, unknown>, where)) {
            applyData(r as unknown as Record<string, unknown>, data);
            count += 1;
          }
        }
        return { count };
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
    __events: events,
    __subs: subs,
  };
  (prisma as unknown as { $transaction: (cb: (tx: typeof prisma) => unknown) => Promise<unknown> }).$transaction =
    async (cb) => cb(prisma);
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
  payload: { event: { app_user_id: "cust_u1" } },
  ...over,
});

function make(seed?: Parameters<typeof makeFakePrisma>[0], environment: "production" | "sandbox" = "production") {
  const prisma = makeFakePrisma(seed);
  const provider = new FakeProvider();
  const service = new SubscriptionSyncService(prisma as unknown as PrismaService, provider, environment);
  return { prisma, provider, service };
}
const U1 = [{ provider: "REVENUECAT", customerId: "cust_u1", userId: "u1" }];
const ev = (prisma: ReturnType<typeof makeFakePrisma>) => prisma.__events.find((r) => r.eventId === "e1");

describe("순수 헬퍼", () => {
  it("isTerminalStatus: processed·dead만 종결", () => {
    expect(isTerminalStatus("processed")).toBe(true);
    expect(isTerminalStatus("dead")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(false);
    expect(isTerminalStatus("received")).toBe(false);
  });
  it("computeNextRetry: 미래·단조 증가 경향·cap", () => {
    const a1 = computeNextRetry(1, NOW).getTime() - NOW.getTime();
    const a3 = computeNextRetry(3, NOW).getTime() - NOW.getTime();
    expect(a1).toBeGreaterThan(0);
    expect(a3).toBeGreaterThan(a1);
    expect(computeNextRetry(99, NOW).getTime() - NOW.getTime()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});

describe("SubscriptionSyncService.processEvent", () => {
  it("종결(processed) → duplicate", async () => {
    const { service, provider } = make({ customers: U1, events: [{ status: "processed" }] });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    expect((await service.processEvent(evt(), NOW)).outcome).toBe("duplicate");
  });

  it("종결(dead) → duplicate (한도 초과 영구 종결)", async () => {
    const { service } = make({ customers: U1, events: [{ status: "dead" }] });
    expect((await service.processEvent(evt(), NOW)).outcome).toBe("duplicate");
  });

  it("failed 이벤트 재전송 → claim 재처리 성공(applied) + processed", async () => {
    const { service, provider, prisma } = make({ customers: U1, events: [{ status: "failed", attempts: 1 }] });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("applied");
    expect(ev(prisma)?.status).toBe("processed");
    expect(ev(prisma)?.attempts).toBe(2); // claim이 1 증가
    expect(prisma.__subs.get("PLAY|ext_1")?.status).toBe("active");
  });

  it("다른 처리자 보유(processing·lease 유효) → claim 실패 → duplicate", async () => {
    const future = new Date(NOW.getTime() + 60_000);
    const { service, provider } = make({ customers: U1, events: [{ status: "processing", leaseExpiresAt: future, attempts: 1 }] });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    expect((await service.processEvent(evt(), NOW)).outcome).toBe("duplicate");
  });

  it("환경 불일치(sandbox) → skipped", async () => {
    const { service, provider, prisma } = make({ customers: U1 }, "production");
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    const r = await service.processEvent(evt({ environment: "sandbox" }), NOW);
    expect(r.outcome).toBe("skipped");
    expect(ev(prisma)?.status).toBe("skipped");
    expect(ev(prisma)?.errorCode).toBe("env_mismatch");
  });

  it("매핑 없음 → unmapped (skipped 기록, 매핑 생성 안 함)", async () => {
    const { service, prisma } = make({ customers: [] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("unmapped");
    expect(ev(prisma)?.status).toBe("skipped");
  });

  it("공급자 실패 → provider_error + failed + nextRetryAt 예약", async () => {
    const { service, provider, prisma } = make({ customers: U1 });
    provider.set("cust_u1", { ok: false, errorCode: "upstream_down" });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("provider_error");
    expect(ev(prisma)?.status).toBe("failed");
    expect(ev(prisma)?.nextRetryAt).toBeInstanceOf(Date);
  });

  it("공급자 실패 + attempts가 MAX 도달 → dead(영구 종결)", async () => {
    const { service, provider, prisma } = make({
      customers: U1,
      events: [{ status: "failed", attempts: SUBSCRIPTION_MAX_ATTEMPTS - 1, nextRetryAt: new Date(NOW.getTime() - 1000) }],
    });
    provider.set("cust_u1", { ok: false, errorCode: "upstream_down" });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("provider_error");
    expect(ev(prisma)?.status).toBe("dead");
    expect(ev(prisma)?.nextRetryAt).toBeNull();
  });

  it("정상 신규 → applied + active", async () => {
    const { service, provider, prisma } = make({ customers: U1 });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("applied");
    expect(prisma.__subs.get("PLAY|ext_1")?.userId).toBe("u1");
    expect(ev(prisma)?.status).toBe("processed");
  });

  it("타 계정 귀속 → conflict (기존 소유자 유지)", async () => {
    const { service, provider, prisma } = make({
      customers: U1,
      subs: [{ id: "sub_x", userId: "u2", verifiedAt: new Date("2026-10-10T00:00:00Z"), status: "active", platform: "PLAY", externalId: "ext_1" }],
    });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.conflicts).toBe(1);
    expect(r.applied).toBe(0);
    expect(prisma.__subs.get("PLAY|ext_1")?.userId).toBe("u2");
  });

  it("stale(더 최신 쓰기 존재) → skippedStale", async () => {
    const { service, provider, prisma } = make({
      customers: U1,
      subs: [{ id: "sub_x", userId: "u1", verifiedAt: new Date("2026-10-16T00:00:00Z"), status: "active", platform: "PLAY", externalId: "ext_1" }],
    });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap({ status: "expired" })] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.skippedStale).toBe(1);
    expect(prisma.__subs.get("PLAY|ext_1")?.status).toBe("active");
  });

  it("유예 만료(gracePeriodEnd 과거) → expired로 투영", async () => {
    const { service, provider, prisma } = make({ customers: U1 });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap({ status: "grace", gracePeriodEnd: new Date("2026-10-10T00:00:00Z") })] });
    const r = await service.processEvent(evt(), NOW);
    expect(r.outcome).toBe("applied");
    expect(prisma.__subs.get("PLAY|ext_1")?.status).toBe("expired");
  });

  it("처리 중 예외 → failed 기록 후 rethrow", async () => {
    const { service, provider, prisma } = make({ customers: U1 });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    (prisma as unknown as { $transaction: () => Promise<unknown> }).$transaction = async () => {
      throw new Error("boom");
    };
    await expect(service.processEvent(evt(), NOW)).rejects.toThrow("boom");
    expect(ev(prisma)?.status).toBe("failed");
  });
});

describe("SubscriptionSyncService.reconcileCustomer", () => {
  it("ok:true → applied 반영", async () => {
    const { service, provider, prisma } = make({ customers: U1 });
    provider.set("cust_u1", { ok: true, subscriptions: [activeSnap()] });
    const r = await service.reconcileCustomer("cust_u1", NOW);
    expect(r.outcome).toBe("applied");
    expect(prisma.__subs.get("PLAY|ext_1")?.status).toBe("active");
  });

  it("공급자 실패 → provider_error (만료·강등 없음)", async () => {
    const { service, provider, prisma } = make({
      customers: U1,
      subs: [{ id: "sub_x", userId: "u1", verifiedAt: new Date("2026-10-10T00:00:00Z"), status: "active", platform: "PLAY", externalId: "ext_1" }],
    });
    provider.set("cust_u1", { ok: false, errorCode: "upstream_down" });
    const r = await service.reconcileCustomer("cust_u1", NOW);
    expect(r.outcome).toBe("provider_error");
    expect(prisma.__subs.get("PLAY|ext_1")?.status).toBe("active"); // 유지
  });

  it("매핑 없음 → unmapped", async () => {
    const { service } = make({ customers: [] });
    expect((await service.reconcileCustomer("nobody", NOW)).outcome).toBe("unmapped");
  });
});
