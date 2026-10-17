import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service";
import {
  SUBSCRIPTION_MAX_ATTEMPTS,
  SubscriptionSyncService,
  type IncomingSubscriptionEvent,
} from "./subscription-sync.service";

export const SUBSCRIPTION_RETRY_DEFAULT_LIMIT = 100;
export const SUBSCRIPTION_RETRY_DEFAULT_MAX = 500; // 초과 시 run 중단(폭주 방어)

export function subscriptionJobsDisabled(): boolean {
  const d = process.env.SUBSCRIPTION_JOBS_DISABLED;
  return d === "1" || d === "true";
}

export interface RetryCandidate {
  id: string;
  eventId: string;
  status: string;
  attempts: number;
  nextRetryAt: Date | null;
}
export interface RetryDryRunReport {
  mode: "dry-run";
  totalCandidates: number;
  batch: number;
  items: RetryCandidate[];
}
export interface RetryExecuteReport {
  mode: "execute";
  totalCandidates: number;
  attempted: number;
  succeeded: number;
  failed: number; // 이번에 실패(다음 재시도 예약)
  deadLettered: number; // 이번에 MAX 도달 → dead
  skipped: number; // 매핑없음·환경불일치·다른 처리자 보유
  remainingBacklog: number; // 실행 후 남은 후보
  totalDead: number; // 누적 dead
  aborted?: { reason: string; totalCandidates: number; cap: number };
}

// 수신함 재시도 잡(#165 Slice 3). 선택+호출만 — attempts/상태/스케줄은 processEvent(공통 경로)가 기록.
// 집 운영잡 패턴: dry-run 기본·--execute·kill-switch·limit+cap. setInterval·부트훅·HTTP 금지.
@Injectable()
export class SubscriptionRetryService {
  private readonly logger = new Logger(SubscriptionRetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SubscriptionSyncService,
  ) {}

  // 재시도 대상: 재시도 가능 failed(기한 도래)·미처리 received·lease 만료된 processing(회수).
  private candidateWhere(now: Date) {
    return {
      OR: [
        {
          status: "failed" as const,
          attempts: { lt: SUBSCRIPTION_MAX_ATTEMPTS },
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        { status: "received" as const, attempts: { lt: SUBSCRIPTION_MAX_ATTEMPTS } },
        { status: "processing" as const, leaseExpiresAt: { lt: now } },
      ],
    };
  }

  async dryRun(now: Date, limit = SUBSCRIPTION_RETRY_DEFAULT_LIMIT): Promise<RetryDryRunReport> {
    const where = this.candidateWhere(now);
    const totalCandidates = await this.prisma.subscriptionEvent.count({ where });
    const rows = await this.prisma.subscriptionEvent.findMany({
      where,
      orderBy: [{ nextRetryAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      take: limit,
      select: { id: true, eventId: true, status: true, attempts: true, nextRetryAt: true },
    });
    this.logger.log(`[dry-run] 후보 ${totalCandidates}건 · 이번 배치 ${rows.length}건`);
    return { mode: "dry-run", totalCandidates, batch: rows.length, items: rows };
  }

  async execute(
    now: Date,
    limit = SUBSCRIPTION_RETRY_DEFAULT_LIMIT,
    maxCandidates = SUBSCRIPTION_RETRY_DEFAULT_MAX,
  ): Promise<RetryExecuteReport> {
    const base: RetryExecuteReport = {
      mode: "execute",
      totalCandidates: 0,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      deadLettered: 0,
      skipped: 0,
      remainingBacklog: 0,
      totalDead: 0,
    };
    if (subscriptionJobsDisabled()) {
      this.logger.warn("[execute] SUBSCRIPTION_JOBS_DISABLED — 실행 거부(kill-switch).");
      return { ...base, aborted: { reason: "kill_switch_disabled", totalCandidates: 0, cap: maxCandidates } };
    }

    const where = this.candidateWhere(now);
    const totalCandidates = await this.prisma.subscriptionEvent.count({ where });
    if (totalCandidates > maxCandidates) {
      this.logger.error(`[execute] 후보 ${totalCandidates} > 상한 ${maxCandidates} — 중단.`);
      return { ...base, totalCandidates, aborted: { reason: "overflow", totalCandidates, cap: maxCandidates } };
    }

    const rows = await this.prisma.subscriptionEvent.findMany({
      where,
      orderBy: [{ nextRetryAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      take: limit,
      select: {
        provider: true,
        projectId: true,
        eventId: true,
        type: true,
        environment: true,
        occurredAt: true,
        attempts: true,
        payload: true,
      },
    });

    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    let deadLettered = 0;
    let skipped = 0;
    for (const row of rows) {
      const evt = this.toEvent(row);
      attempted += 1;
      const willBeDead = row.attempts + 1 >= SUBSCRIPTION_MAX_ATTEMPTS;
      try {
        const r = await this.sync.processEvent(evt, new Date());
        if (r.outcome === "applied" || r.outcome === "noop") succeeded += 1;
        else if (r.outcome === "provider_error") {
          if (willBeDead) deadLettered += 1;
          else failed += 1;
        } else skipped += 1; // duplicate(다른 처리자/종결)·unmapped·skipped
      } catch {
        // processEvent는 실패를 이미 기록(failed/dead) 후 rethrow.
        if (willBeDead) deadLettered += 1;
        else failed += 1;
      }
    }

    const remainingBacklog = await this.prisma.subscriptionEvent.count({ where: this.candidateWhere(new Date()) });
    const totalDead = await this.prisma.subscriptionEvent.count({ where: { status: "dead" } });
    this.logger.log(
      `[execute] 시도 ${attempted} · 성공 ${succeeded} · 실패 ${failed} · dead ${deadLettered} · skip ${skipped} · backlog ${remainingBacklog} · 누적 dead ${totalDead}`,
    );
    if (deadLettered > 0) this.logger.warn(`[execute] 이번 실행 dead-letter ${deadLettered}건 — 운영 확인 필요.`);
    return {
      ...base,
      totalCandidates,
      attempted,
      succeeded,
      failed,
      deadLettered,
      skipped,
      remainingBacklog,
      totalDead,
    };
  }

  // 저장된 행 + payload로 IncomingSubscriptionEvent 복원. customerId는 RevenueCat payload의 app_user_id.
  private toEvent(row: {
    provider: string;
    projectId: string;
    eventId: string;
    type: string;
    environment: string;
    occurredAt: Date;
    payload: unknown;
  }): IncomingSubscriptionEvent {
    const payload = row.payload as { event?: { app_user_id?: string } } | null;
    const customerId = payload?.event?.app_user_id ?? "";
    return {
      provider: "REVENUECAT",
      projectId: row.projectId,
      eventId: row.eventId,
      type: row.type,
      environment: row.environment === "sandbox" ? "sandbox" : "production",
      occurredAt: row.occurredAt,
      customerId,
      payload: row.payload,
    };
  }
}
