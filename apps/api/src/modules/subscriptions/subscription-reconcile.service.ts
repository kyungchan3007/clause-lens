import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service";
import { SubscriptionSyncService } from "./subscription-sync.service";
import { subscriptionJobsDisabled } from "./subscription-retry.service";

export const SUBSCRIPTION_RECONCILE_DEFAULT_LIMIT = 100;

export interface ReconcileDryRunReport {
  mode: "dry-run";
  totalCustomers: number;
  batch: number;
  customerIds: string[];
  nextCursor: string | null;
}
export interface ReconcileExecuteReport {
  mode: "execute";
  processed: number;
  applied: number;
  noop: number;
  unmapped: number;
  providerError: number;
  nextCursor: string | null;
  aborted?: { reason: string };
}

// 정기 대사 잡(#165 Slice 3). BillingCustomer를 안정 커서로 순회해 공급자 현재 상태 재조회·반영.
// **사라진 구독 만료는 보류**(Slice 1 스키마 확장·완전스냅샷 보장 필요 → 후속). ok:false 고객은 skip.
// 집 운영잡 패턴: dry-run 기본·--execute·kill-switch·limit+커서. setInterval·부트훅·HTTP 금지.
@Injectable()
export class SubscriptionReconcileService {
  private readonly logger = new Logger(SubscriptionReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SubscriptionSyncService,
  ) {}

  private async loadBatch(limit: number, after?: string) {
    return this.prisma.billingCustomer.findMany({
      where: { provider: "REVENUECAT" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      select: { id: true, customerId: true },
    });
  }

  async dryRun(limit = SUBSCRIPTION_RECONCILE_DEFAULT_LIMIT, after?: string): Promise<ReconcileDryRunReport> {
    const totalCustomers = await this.prisma.billingCustomer.count({ where: { provider: "REVENUECAT" } });
    const rows = await this.loadBatch(limit, after);
    const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null;
    this.logger.log(`[dry-run] 고객 ${totalCustomers}명 · 이번 배치 ${rows.length}명`);
    return {
      mode: "dry-run",
      totalCustomers,
      batch: rows.length,
      customerIds: rows.map((r) => r.customerId),
      nextCursor,
    };
  }

  async execute(limit = SUBSCRIPTION_RECONCILE_DEFAULT_LIMIT, after?: string): Promise<ReconcileExecuteReport> {
    const base: ReconcileExecuteReport = {
      mode: "execute",
      processed: 0,
      applied: 0,
      noop: 0,
      unmapped: 0,
      providerError: 0,
      nextCursor: null,
    };
    if (subscriptionJobsDisabled()) {
      this.logger.warn("[execute] SUBSCRIPTION_JOBS_DISABLED — 실행 거부(kill-switch).");
      return { ...base, aborted: { reason: "kill_switch_disabled" } };
    }

    const rows = await this.loadBatch(limit, after);
    let applied = 0;
    let noop = 0;
    let unmapped = 0;
    let providerError = 0;
    for (const row of rows) {
      const r = await this.sync.reconcileCustomer(row.customerId, new Date());
      if (r.outcome === "applied") applied += 1;
      else if (r.outcome === "provider_error") providerError += 1;
      else if (r.outcome === "unmapped") unmapped += 1;
      else noop += 1;
    }
    const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null;
    this.logger.log(
      `[execute] 처리 ${rows.length} · 반영 ${applied} · noop ${noop} · unmapped ${unmapped} · 공급자실패 ${providerError} · nextCursor ${nextCursor ?? "(끝)"}`,
    );
    if (providerError > 0) this.logger.warn(`[execute] 공급자 재조회 실패 ${providerError}건 — 해당 고객 미반영(유지).`);
    return { ...base, processed: rows.length, applied, noop, unmapped, providerError, nextCursor };
  }
}
