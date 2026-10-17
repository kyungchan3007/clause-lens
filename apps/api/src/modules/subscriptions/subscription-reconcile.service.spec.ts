import type { PrismaService } from "../../db/prisma.service";
import { SubscriptionReconcileService } from "./subscription-reconcile.service";
import type { SubscriptionSyncService, SyncOutcome } from "./subscription-sync.service";

const NOW = new Date("2026-10-15T00:00:00.000Z");

function makeService(opts: {
  total: number;
  customers: { id: string; customerId: string }[];
  outcomes?: SyncOutcome[];
}) {
  const reconciled: string[] = [];
  let idx = 0;
  const prisma = {
    billingCustomer: {
      count: async () => opts.total,
      findMany: async ({ take }: { take: number }) => opts.customers.slice(0, take),
    },
  };
  const sync = {
    reconcileCustomer: async (customerId: string) => {
      reconciled.push(customerId);
      const o = opts.outcomes?.[idx] ?? "applied";
      idx += 1;
      return { outcome: o, applied: o === "applied" ? 1 : 0, conflicts: 0, skippedStale: 0 };
    },
  };
  const service = new SubscriptionReconcileService(
    prisma as unknown as PrismaService,
    sync as unknown as SubscriptionSyncService,
  );
  return { service, reconciled };
}

describe("SubscriptionReconcileService", () => {
  const prev = process.env.SUBSCRIPTION_JOBS_DISABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.SUBSCRIPTION_JOBS_DISABLED;
    else process.env.SUBSCRIPTION_JOBS_DISABLED = prev;
  });

  it("dry-run → 총원/배치/커서(배치가 limit 미만이면 nextCursor null)", async () => {
    const { service, reconciled } = makeService({
      total: 2,
      customers: [{ id: "b1", customerId: "c1" }, { id: "b2", customerId: "c2" }],
    });
    const r = await service.dryRun(10);
    expect(r.totalCustomers).toBe(2);
    expect(r.customerIds).toEqual(["c1", "c2"]);
    expect(r.nextCursor).toBeNull(); // 2 < limit 10
    expect(reconciled).toHaveLength(0);
  });

  it("배치가 limit 꽉 차면 nextCursor = 마지막 id", async () => {
    const { service } = makeService({
      total: 5,
      customers: [{ id: "b1", customerId: "c1" }, { id: "b2", customerId: "c2" }],
    });
    const r = await service.dryRun(2);
    expect(r.nextCursor).toBe("b2");
  });

  it("kill-switch → aborted", async () => {
    process.env.SUBSCRIPTION_JOBS_DISABLED = "true";
    const { service, reconciled } = makeService({ total: 1, customers: [{ id: "b1", customerId: "c1" }] });
    const r = await service.execute(10);
    expect(r.aborted?.reason).toBe("kill_switch_disabled");
    expect(reconciled).toHaveLength(0);
  });

  it("execute 집계 — applied·provider_error·unmapped·noop", async () => {
    const { service, reconciled } = makeService({
      total: 4,
      customers: [
        { id: "b1", customerId: "c1" },
        { id: "b2", customerId: "c2" },
        { id: "b3", customerId: "c3" },
        { id: "b4", customerId: "c4" },
      ],
      outcomes: ["applied", "provider_error", "unmapped", "noop"],
    });
    const r = await service.execute(10);
    expect(r.processed).toBe(4);
    expect(r.applied).toBe(1);
    expect(r.providerError).toBe(1);
    expect(r.unmapped).toBe(1);
    expect(r.noop).toBe(1);
    expect(reconciled).toEqual(["c1", "c2", "c3", "c4"]);
  });
});
