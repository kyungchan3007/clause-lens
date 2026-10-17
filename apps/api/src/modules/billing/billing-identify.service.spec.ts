import { ConflictException } from "@nestjs/common";

import type { PrismaService } from "../../db/prisma.service";
import type { SubscriptionSyncService, SyncResult } from "../subscriptions/subscription-sync.service";
import { BillingIdentifyService } from "./billing-identify.service";

const NOW = new Date("2026-10-17T00:00:00.000Z");

function make(opts: {
  existing?: { userId: string } | null;
  createThrows?: "P2002" | "other";
  reconcile?: SyncResult;
}) {
  const created: Record<string, unknown>[] = [];
  const reconciled: string[] = [];
  const prisma = {
    billingCustomer: {
      findUnique: async () => opts.existing ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (opts.createThrows === "P2002") throw { code: "P2002" };
        if (opts.createThrows === "other") throw new Error("db_down");
        created.push(data);
        return data;
      },
    },
  };
  const sync = {
    reconcileCustomer: async (customerId: string) => {
      reconciled.push(customerId);
      return opts.reconcile ?? { outcome: "noop", applied: 0, conflicts: 0, skippedStale: 0 };
    },
  };
  const service = new BillingIdentifyService(
    prisma as unknown as PrismaService,
    sync as unknown as SubscriptionSyncService,
  );
  return { service, created, reconciled };
}

describe("BillingIdentifyService.identify", () => {
  it("신규 사용자 → 매핑 생성(customerId=userId) + 재동기화 호출", async () => {
    const { service, created, reconciled } = make({
      existing: null,
      reconcile: { outcome: "applied", applied: 1, conflicts: 0, skippedStale: 0 },
    });
    const r = await service.identify("u1", NOW);
    expect(r.customerId).toBe("u1");
    expect(r.mappingCreated).toBe(true);
    expect(created[0]).toMatchObject({ userId: "u1", provider: "REVENUECAT", customerId: "u1" });
    expect(reconciled).toEqual(["u1"]);
    expect(r.synced).toEqual({ outcome: "applied", applied: 1 });
  });

  it("이미 있는 매핑(같은 사용자) → 멱등(mappingCreated=false) + 재동기화", async () => {
    const { service, created, reconciled } = make({ existing: { userId: "u1" } });
    const r = await service.identify("u1", NOW);
    expect(r.mappingCreated).toBe(false);
    expect(created).toHaveLength(0);
    expect(reconciled).toEqual(["u1"]);
  });

  it("타 소유자 매핑 → ConflictException(재할당 금지)", async () => {
    const { service } = make({ existing: { userId: "other" } });
    await expect(service.identify("u1", NOW)).rejects.toThrow(ConflictException);
  });

  it("동시 생성 레이스(P2002) → 무해(mappingCreated=false)", async () => {
    const { service, reconciled } = make({ existing: null, createThrows: "P2002" });
    const r = await service.identify("u1", NOW);
    expect(r.mappingCreated).toBe(false);
    expect(reconciled).toEqual(["u1"]); // 그래도 재동기화는 진행
  });

  it("create 기타 예외 → 전파", async () => {
    const { service } = make({ existing: null, createThrows: "other" });
    await expect(service.identify("u1", NOW)).rejects.toThrow("db_down");
  });

  it("재동기화 outcome 매핑 — duplicate 등은 noop로 정규화", async () => {
    const { service } = make({
      existing: { userId: "u1" },
      reconcile: { outcome: "duplicate", applied: 0, conflicts: 0, skippedStale: 0 },
    });
    const r = await service.identify("u1", NOW);
    expect(r.synced.outcome).toBe("noop");
  });

  it("공급자 실패 → synced.outcome provider_error (매핑은 유지)", async () => {
    const { service } = make({
      existing: null,
      reconcile: { outcome: "provider_error", applied: 0, conflicts: 0, skippedStale: 0 },
    });
    const r = await service.identify("u1", NOW);
    expect(r.mappingCreated).toBe(true);
    expect(r.synced.outcome).toBe("provider_error");
  });
});
