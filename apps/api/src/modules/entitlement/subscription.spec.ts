import type { Prisma, PrismaClient } from "@clause-lens/db";
import {
  canSaveDocuments,
  getAnalysisAccess,
  isEffectivelyActive,
  isStaleWrite,
  monthWindowStart,
  normalizeProviderSnapshot,
  reserveAnalysis,
  resolveOwnership,
  settleAnalysis,
  subscriptionQuotaRemaining,
  SUBSCRIPTION_MONTHLY_QUOTA,
  type ProviderSubscriptionSnapshot,
  type SubscriptionLike,
} from "@clause-lens/db/analysis";

const NOW = new Date("2026-10-15T00:00:00.000Z");
const sub = (over: Partial<SubscriptionLike> = {}): SubscriptionLike => ({
  status: "active",
  currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
  ...over,
});

// ── 순수 함수 ──────────────────────────────────────────────
describe("subscription-ops (순수)", () => {
  it("isEffectivelyActive: active는 기간 남아야 유효, grace는 gracePeriodEnd 전까지, expired는 무효", () => {
    expect(isEffectivelyActive(sub(), NOW)).toBe(true);
    expect(isEffectivelyActive(sub({ currentPeriodEnd: new Date("2026-10-01T00:00:00Z") }), NOW)).toBe(false); // active인데 만료
    // grace: 결제기간은 지났어도 gracePeriodEnd가 미래면 유효
    expect(isEffectivelyActive(sub({ status: "grace", currentPeriodEnd: new Date("2026-10-01T00:00:00Z"), gracePeriodEnd: new Date("2026-10-20T00:00:00Z") }), NOW)).toBe(true);
    // grace: gracePeriodEnd 경과면 무효(만료 알림 누락 시 영구 권한 버그 방지)
    expect(isEffectivelyActive(sub({ status: "grace", currentPeriodEnd: new Date("2026-10-01T00:00:00Z"), gracePeriodEnd: new Date("2026-10-10T00:00:00Z") }), NOW)).toBe(false);
    // grace: 기한 없으면 무효
    expect(isEffectivelyActive(sub({ status: "grace", gracePeriodEnd: null }), NOW)).toBe(false);
    expect(isEffectivelyActive(sub({ status: "expired" }), NOW)).toBe(false);
  });

  it("canSaveDocuments: 유효 구독 하나라도 있으면 true", () => {
    expect(canSaveDocuments([sub({ status: "expired" }), sub()], NOW)).toBe(true);
    expect(canSaveDocuments([sub({ status: "expired" })], NOW)).toBe(false);
    expect(canSaveDocuments([], NOW)).toBe(false);
  });

  it("monthWindowStart: 현재 UTC 캘린더월 1일", () => {
    expect(monthWindowStart(NOW).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("subscriptionQuotaRemaining: 50 - 사용량, 0 하한", () => {
    expect(subscriptionQuotaRemaining(0)).toBe(SUBSCRIPTION_MONTHLY_QUOTA);
    expect(subscriptionQuotaRemaining(50)).toBe(0);
    expect(subscriptionQuotaRemaining(60)).toBe(0);
  });
});

// ── 결제 동기화 순수 로직 (#165 Slice 1) ──────────────────────
describe("subscription sync (순수)", () => {
  const snap = (over: Partial<ProviderSubscriptionSnapshot> = {}): ProviderSubscriptionSnapshot => ({
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

  it("normalize: active 유지(기간 미래)·grace 유지(기한 미래)", () => {
    expect(normalizeProviderSnapshot(snap(), NOW).status).toBe("active");
    expect(
      normalizeProviderSnapshot(snap({ status: "grace", gracePeriodEnd: new Date("2026-10-20T00:00:00Z") }), NOW).status,
    ).toBe("grace");
  });

  it("normalize: 기간 지난 active·기한 지난/없는 grace는 expired로 강등", () => {
    expect(normalizeProviderSnapshot(snap({ currentPeriodEnd: new Date("2026-10-01T00:00:00Z") }), NOW).status).toBe("expired");
    expect(normalizeProviderSnapshot(snap({ status: "grace", gracePeriodEnd: new Date("2026-10-10T00:00:00Z") }), NOW).status).toBe("expired");
    expect(normalizeProviderSnapshot(snap({ status: "grace", gracePeriodEnd: null }), NOW).status).toBe("expired");
  });

  it("normalize: grace가 아니면 gracePeriodEnd를 비운다", () => {
    expect(normalizeProviderSnapshot(snap({ gracePeriodEnd: new Date("2026-10-20T00:00:00Z") }), NOW).gracePeriodEnd).toBeNull();
  });

  it("resolveOwnership: 신규·동일 소유자 ok, 타 소유자 conflict", () => {
    expect(resolveOwnership(null, "u1")).toBe("ok");
    expect(resolveOwnership({ userId: "u1" }, "u1")).toBe("ok");
    expect(resolveOwnership({ userId: "u1" }, "u2")).toBe("conflict");
  });

  it("isStaleWrite: 기존 verifiedAt가 조회 시작 이후면 stale(버림)", () => {
    const qStart = new Date("2026-10-15T00:00:00Z");
    expect(isStaleWrite(null, qStart)).toBe(false);
    expect(isStaleWrite({ verifiedAt: new Date("2026-10-14T00:00:00Z") }, qStart)).toBe(false);
    expect(isStaleWrite({ verifiedAt: new Date("2026-10-15T00:00:01Z") }, qStart)).toBe(true);
  });
});

// ── 가짜 tx(구독·charge·entitlement) ──────────────────────
interface Charge {
  jobId: string;
  userId: string;
  status: "reserved" | "consumed" | "released";
  source: "FREE" | "SUBSCRIPTION";
  createdAt: Date;
  settledAt: Date | null;
}
function makeTx(opts: { granted?: number; subs?: SubscriptionLike[] } = {}) {
  const ent = { userId: "u1", freeGranted: opts.granted ?? 3, freeConsumed: 0, freeReserved: 0 };
  const subs = opts.subs ?? [];
  const charges = new Map<string, Charge>();
  const inWindow = (c: Charge, where: { createdAt?: { gte?: Date } }) =>
    !where.createdAt?.gte || c.createdAt.getTime() >= where.createdAt.gte.getTime();

  const tx = {
    entitlement: {
      upsert: async () => ent,
      findUniqueOrThrow: async () => ent,
      update: async ({ data }: { data: Record<string, { increment?: number; decrement?: number }> }) => {
        for (const [k, v] of Object.entries(data)) {
          const key = k as "freeReserved" | "freeConsumed";
          if (v.increment) ent[key] += v.increment;
          if (v.decrement) ent[key] -= v.decrement;
        }
        return ent;
      },
    },
    subscription: {
      findMany: async ({ where }: { where: { status: { in: string[] } } }) =>
        subs.filter((s) => where.status.in.includes(s.status)),
    },
    entitlementCharge: {
      findUnique: async ({ where }: { where: { jobId: string } }) => charges.get(where.jobId) ?? null,
      create: async ({ data }: { data: Partial<Charge> & { jobId: string; userId: string; status: Charge["status"] } }) => {
        const row: Charge = { settledAt: null, source: "FREE", createdAt: NOW, ...data };
        charges.set(data.jobId, row);
        return row;
      },
      count: async ({ where }: { where: { source?: string; status?: { in: string[] }; createdAt?: { gte?: Date } } }) =>
        [...charges.values()].filter(
          (c) =>
            (!where.source || c.source === where.source) &&
            (!where.status || where.status.in.includes(c.status)) &&
            inWindow(c, where),
        ).length,
      updateMany: async ({ where, data }: { where: { jobId: string; status: string }; data: Partial<Charge> }) => {
        const row = charges.get(where.jobId);
        if (!row || row.status !== where.status) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    $executeRaw: async () => {
      if (ent.freeGranted - ent.freeConsumed - ent.freeReserved >= 1) {
        ent.freeReserved += 1;
        return 1;
      }
      return 0;
    },
    $queryRaw: async (_s: TemplateStringsArray, target: Charge["status"], jobId: string) => {
      const row = charges.get(jobId);
      if (!row || row.status !== "reserved") return [];
      row.status = target;
      row.settledAt = new Date();
      return [{ userId: row.userId }];
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, prisma: tx as unknown as PrismaClient, ent, charges };
}

describe("reserveAnalysis (근거 선택)", () => {
  it("유효 구독 + 쿼터 잔여 → SUBSCRIPTION charge, 무료 카운터 불변", async () => {
    const { tx, ent, charges } = makeTx({ subs: [sub()] });
    expect(await reserveAnalysis(tx, "u1", "j1", NOW)).toBe(true);
    expect(charges.get("j1")?.source).toBe("SUBSCRIPTION");
    expect(ent.freeReserved).toBe(0); // 무료 미사용
  });

  it("구독 없으면 무료 폴백(FREE) + freeReserved++", async () => {
    const { tx, ent, charges } = makeTx({ subs: [] });
    expect(await reserveAnalysis(tx, "u1", "j1", NOW)).toBe(true);
    expect(charges.get("j1")?.source).toBe("FREE");
    expect(ent.freeReserved).toBe(1);
  });

  it("구독이지만 월 쿼터 소진 → 무료 폴백", async () => {
    const { tx, charges } = makeTx({ subs: [sub()] });
    // window 내 SUBSCRIPTION reserved 50건 선점
    for (let i = 0; i < SUBSCRIPTION_MONTHLY_QUOTA; i += 1) {
      charges.set(`s${i}`, { jobId: `s${i}`, userId: "u1", status: "reserved", source: "SUBSCRIPTION", createdAt: NOW, settledAt: null });
    }
    expect(await reserveAnalysis(tx, "u1", "j1", NOW)).toBe(true);
    expect(charges.get("j1")?.source).toBe("FREE");
  });

  it("무료·구독 다 없으면 거부(false)", async () => {
    const { tx } = makeTx({ granted: 0, subs: [] });
    expect(await reserveAnalysis(tx, "u1", "j1", NOW)).toBe(false);
  });

  it("같은 jobId 재접수는 멱등(true, 중복 생성 없음)", async () => {
    const { tx, charges } = makeTx({ subs: [sub()] });
    await reserveAnalysis(tx, "u1", "j1", NOW);
    await reserveAnalysis(tx, "u1", "j1", NOW);
    expect(charges.size).toBe(1);
  });
});

describe("settleAnalysis (근거별 정산)", () => {
  it("SUBSCRIPTION done → consumed, 무료 카운터 불변", async () => {
    const { tx, ent, charges } = makeTx({ subs: [sub()] });
    await reserveAnalysis(tx, "u1", "j1", NOW);
    await settleAnalysis(tx, "j1", "done");
    expect(charges.get("j1")?.status).toBe("consumed");
    expect(ent.freeConsumed).toBe(0);
  });

  it("SUBSCRIPTION partial → released", async () => {
    const { tx, charges } = makeTx({ subs: [sub()] });
    await reserveAnalysis(tx, "u1", "j1", NOW);
    await settleAnalysis(tx, "j1", "partial");
    expect(charges.get("j1")?.status).toBe("released");
  });

  it("FREE done → 무료 확정 차감(freeConsumed++)", async () => {
    const { tx, ent, charges } = makeTx({ subs: [] });
    await reserveAnalysis(tx, "u1", "j1", NOW);
    await settleAnalysis(tx, "j1", "done");
    expect(charges.get("j1")?.status).toBe("consumed");
    expect(ent.freeConsumed).toBe(1);
    expect(ent.freeReserved).toBe(0);
  });

  it("정산 멱등 — 두 번 호출해도 1회만", async () => {
    const { tx, ent } = makeTx({ subs: [] });
    await reserveAnalysis(tx, "u1", "j1", NOW);
    await settleAnalysis(tx, "j1", "done");
    await settleAnalysis(tx, "j1", "done");
    expect(ent.freeConsumed).toBe(1);
  });

  it("예약 없는 job 정산은 no-op", async () => {
    const { tx } = makeTx();
    await expect(settleAnalysis(tx, "none", "done")).resolves.toBeUndefined();
  });
});

describe("getAnalysisAccess", () => {
  it("구독자 → 보관 가능 + 월 쿼터 잔여", async () => {
    const { prisma, charges } = makeTx({ subs: [sub()] });
    charges.set("s0", { jobId: "s0", userId: "u1", status: "consumed", source: "SUBSCRIPTION", createdAt: NOW, settledAt: NOW });
    const a = await getAnalysisAccess(prisma, "u1", NOW);
    expect(a.storage.canSave).toBe(true);
    expect(a.analysis).toEqual({ source: "subscription", remaining: SUBSCRIPTION_MONTHLY_QUOTA - 1, monthlyQuota: SUBSCRIPTION_MONTHLY_QUOTA });
  });

  it("비구독 → 보관 불가 + 무료 잔량", async () => {
    const { prisma } = makeTx({ subs: [], granted: 3 });
    const a = await getAnalysisAccess(prisma, "u1", NOW);
    expect(a.storage.canSave).toBe(false);
    expect(a.analysis).toEqual({ source: "free", remaining: 3, monthlyQuota: 3 });
  });
});
