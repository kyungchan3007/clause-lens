import type { PrismaService } from "../../db/prisma.service";
import { SUBSCRIPTION_MAX_ATTEMPTS } from "./subscription-sync.service";
import { SubscriptionRetryService } from "./subscription-retry.service";

const NOW = new Date("2026-10-15T00:00:00.000Z");

type Outcome = "applied" | "noop" | "provider_error" | "duplicate" | "unmapped" | "skipped";
interface Row {
  provider: string;
  projectId: string;
  eventId: string;
  type: string;
  environment: string;
  occurredAt: Date;
  attempts: number;
  payload: unknown;
}

function makeService(opts: {
  candidateCount: number;
  deadCount?: number;
  rows?: Row[];
  processResults?: (Outcome | "throw")[];
}) {
  const calls: unknown[] = [];
  let idx = 0;
  const prisma = {
    subscriptionEvent: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        where.status === "dead" ? (opts.deadCount ?? 0) : opts.candidateCount,
      findMany: async () => opts.rows ?? [],
    },
  };
  const sync = {
    processEvent: async (evt: unknown) => {
      calls.push(evt);
      const res = opts.processResults?.[idx] ?? "applied";
      idx += 1;
      if (res === "throw") throw new Error("boom");
      return { outcome: res, applied: res === "applied" ? 1 : 0, conflicts: 0, skippedStale: 0 };
    },
  };
  const service = new SubscriptionRetryService(
    prisma as unknown as PrismaService,
    sync as unknown as import("./subscription-sync.service").SubscriptionSyncService,
  );
  return { service, calls };
}

const row = (over: Partial<Row> = {}): Row => ({
  provider: "REVENUECAT",
  projectId: "proj_1",
  eventId: "e1",
  type: "INITIAL_PURCHASE",
  environment: "production",
  occurredAt: NOW,
  attempts: 0,
  payload: { event: { app_user_id: "cust_u1" } },
  ...over,
});

describe("SubscriptionRetryService", () => {
  const prev = process.env.SUBSCRIPTION_JOBS_DISABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.SUBSCRIPTION_JOBS_DISABLED;
    else process.env.SUBSCRIPTION_JOBS_DISABLED = prev;
  });

  it("dry-run → 후보/배치 리포트", async () => {
    const { service, calls } = makeService({ candidateCount: 2, rows: [row(), row({ eventId: "e2" })] });
    const r = await service.dryRun(NOW, 50);
    expect(r.mode).toBe("dry-run");
    expect(r.totalCandidates).toBe(2);
    expect(calls).toHaveLength(0); // dry-run은 processEvent 호출 안 함
  });

  it("kill-switch → aborted(실행 안 함)", async () => {
    process.env.SUBSCRIPTION_JOBS_DISABLED = "1";
    const { service, calls } = makeService({ candidateCount: 5, rows: [row()] });
    const r = await service.execute(NOW, 50, 500);
    expect(r.aborted?.reason).toBe("kill_switch_disabled");
    expect(calls).toHaveLength(0);
  });

  it("후보 초과(cap) → aborted overflow", async () => {
    const { service, calls } = makeService({ candidateCount: 600, rows: [row()] });
    const r = await service.execute(NOW, 50, 500);
    expect(r.aborted?.reason).toBe("overflow");
    expect(calls).toHaveLength(0);
  });

  it("execute 집계 — 성공·실패·dead 구분", async () => {
    const { service } = makeService({
      candidateCount: 3,
      deadCount: 1,
      rows: [
        row({ eventId: "ok", attempts: 0 }),
        row({ eventId: "retry", attempts: 0 }), // provider_error, attempts+1<MAX → failed
        row({ eventId: "max", attempts: SUBSCRIPTION_MAX_ATTEMPTS - 1 }), // provider_error, attempts+1>=MAX → dead
      ],
      processResults: ["applied", "provider_error", "provider_error"],
    });
    const r = await service.execute(NOW, 50, 500);
    expect(r.attempted).toBe(3);
    expect(r.succeeded).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.deadLettered).toBe(1);
    expect(r.totalDead).toBe(1);
  });

  it("claim 실패(duplicate)·unmapped → skipped 집계", async () => {
    const { service } = makeService({
      candidateCount: 2,
      rows: [row({ eventId: "dup" }), row({ eventId: "unm" })],
      processResults: ["duplicate", "unmapped"],
    });
    const r = await service.execute(NOW, 50, 500);
    expect(r.skipped).toBe(2);
    expect(r.succeeded).toBe(0);
  });

  it("processEvent 예외 → failed/dead 집계(크래시 안 전파)", async () => {
    const { service } = makeService({
      candidateCount: 1,
      rows: [row({ eventId: "boom", attempts: 0 })],
      processResults: ["throw"],
    });
    const r = await service.execute(NOW, 50, 500);
    expect(r.failed).toBe(1);
  });
});
