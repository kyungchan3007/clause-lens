import { Inject, Injectable } from "@nestjs/common";
import {
  isStaleWrite,
  isUniqueViolation,
  normalizeProviderSnapshot,
  resolveOwnership,
  type ProviderSubscriptionSnapshot,
} from "@clause-lens/db/analysis";

import { PrismaService } from "../../db/prisma.service";
import { BILLING_PROVIDER, type BillingProviderPort } from "./billing-provider.port";

// 이 서버 인스턴스가 처리할 환경(production|sandbox). 다른 환경 이벤트는 skip(sandbox가 운영 행 덮기 방지).
export const SUBSCRIPTION_SYNC_ENVIRONMENT = "SUBSCRIPTION_SYNC_ENVIRONMENT";

// ── 재시도·claim 상수 (#165 Slice 3) ─────────────────────────
export const SUBSCRIPTION_MAX_ATTEMPTS = 8; // 초과 시 dead-letter(영구 종결)
export const CLAIM_LEASE_MS = 5 * 60 * 1000; // processing 보유 lease(크래시 회수 창)
const RETRY_BACKOFF_BASE_MS = 5 * 60 * 1000;
const RETRY_BACKOFF_CAP_MS = 24 * 60 * 60 * 1000;

/** 지수 백오프 + jitter. attempts는 claim으로 증가된 "현재까지 시도 횟수"(1부터). */
export function computeNextRetry(attempts: number, now: Date): Date {
  const exp = Math.min(RETRY_BACKOFF_CAP_MS, RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
  const jitter = exp * (0.8 + Math.random() * 0.4); // ±20%
  return new Date(now.getTime() + Math.min(RETRY_BACKOFF_CAP_MS, jitter));
}

/** 종결 상태(재처리 금지). */
export function isTerminalStatus(status: string): boolean {
  return status === "processed" || status === "dead";
}

// 공급자가 보낸 이벤트(수신함에 넣기 전 정규화된 입력). 실제 웹훅 파싱·인증은 컨트롤러/가드.
export interface IncomingSubscriptionEvent {
  provider: "REVENUECAT";
  projectId: string;
  eventId: string;
  type: string;
  environment: "production" | "sandbox";
  occurredAt: Date;
  customerId: string; // 공급자 app_user_id → BillingCustomer 매핑 키
  payload: unknown; // 재처리용 최소 payload
}

export type SyncOutcome =
  | "duplicate" // 이미 종결(processed/dead)이거나 claim 실패(다른 처리자 보유) — no-op
  | "unmapped" // 고객 매핑 없음 → 귀속 불가(기록만)
  | "skipped" // 환경 불일치 등 — 의도적 미반영(기록만)
  | "provider_error" // 재조회 실패 → 기존 상태 유지(재시도 대상)
  | "applied" // 1건 이상 반영
  | "noop"; // 반영할 변화 없음(stale/빈 상태/전부 충돌)

export interface SyncResult {
  outcome: SyncOutcome;
  applied: number;
  conflicts: number;
  skippedStale: number;
}

// claim lease를 잃은 완료 시도(다른 처리자가 회수함) — 롤백 후 no-op로 처리.
class LeaseLostError extends Error {
  constructor() {
    super("lease_lost");
  }
}

// 결제 이벤트 → 수신함 멱등 저장 → 공급자 재조회 → Subscription 반영.
// 설계: ADR-12 + Codex(Slice 1·2·3). 웹훅=트리거, 행=검증된 현재 상태의 투영.
// Slice 3: 웹훅·재시도가 공유하는 원자 claim(+lease) — 성공이 실패로 역행하지 않도록 조건부 완료.
@Injectable()
export class SubscriptionSyncService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProviderPort,
    @Inject(SUBSCRIPTION_SYNC_ENVIRONMENT)
    private readonly expectedEnvironment: "production" | "sandbox" = "production",
  ) {}

  async processEvent(evt: IncomingSubscriptionEvent, now: Date): Promise<SyncResult> {
    const empty: SyncResult = { outcome: "noop", applied: 0, conflicts: 0, skippedStale: 0 };
    const key = {
      provider_projectId_eventId: {
        provider: evt.provider,
        projectId: evt.projectId,
        eventId: evt.eventId,
      },
    };

    // 1) 종결(processed/dead)이면 재처리 금지.
    const existing = await this.prisma.subscriptionEvent.findUnique({ where: key });
    if (existing && isTerminalStatus(existing.status)) return { ...empty, outcome: "duplicate" };

    // 2) 행 확보(신규 create, P2002 레이스면 재조회).
    let rowId: string;
    if (existing) {
      rowId = existing.id;
    } else {
      try {
        const created = await this.prisma.subscriptionEvent.create({
          data: {
            provider: evt.provider,
            projectId: evt.projectId,
            eventId: evt.eventId,
            type: evt.type,
            environment: evt.environment,
            occurredAt: evt.occurredAt,
            status: "received",
            payload: evt.payload as object,
          },
        });
        rowId = created.id;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        const again = await this.prisma.subscriptionEvent.findUnique({ where: key });
        if (!again) throw e;
        if (isTerminalStatus(again.status)) return { ...empty, outcome: "duplicate" };
        rowId = again.id;
      }
    }

    // 3) 원자 claim — received/failed 또는 lease 만료된 processing만 획득(attempts 증가). 하나만 승리.
    const lease = new Date(now.getTime() + CLAIM_LEASE_MS);
    const claim = await this.prisma.subscriptionEvent.updateMany({
      where: {
        id: rowId,
        OR: [
          { status: { in: ["received", "failed"] } },
          { status: "processing", leaseExpiresAt: { lt: now } },
        ],
      },
      data: { status: "processing", leaseExpiresAt: lease, attempts: { increment: 1 } },
    });
    if (claim.count !== 1) return { ...empty, outcome: "duplicate" }; // 다른 처리자 보유 중

    const claimed = await this.prisma.subscriptionEvent.findUnique({
      where: { id: rowId },
      select: { attempts: true },
    });
    const attempts = claimed?.attempts ?? 1;

    try {
      // 4) 환경 게이트 — 이 서버가 처리하는 환경과 다르면 기록만.
      if (evt.environment !== this.expectedEnvironment) {
        await this.completeTerminalSkip(rowId, lease, "env_mismatch");
        return { ...empty, outcome: "skipped" };
      }

      // 5) 고객 → userId. 매핑 없으면 귀속 불가(기록만). 웹훅으로 매핑 생성 금지(Slice 4).
      const mapping = await this.prisma.billingCustomer.findUnique({
        where: { provider_customerId: { provider: evt.provider, customerId: evt.customerId } },
      });
      if (!mapping) {
        await this.completeTerminalSkip(rowId, lease, "unmapped_customer");
        return { ...empty, outcome: "unmapped" };
      }

      // 6) 공급자 현재 상태 재조회 — 외부 호출(트랜잭션 밖). 실패면 백오프 재시도 예약.
      const q = await this.provider.getSubscriberState(evt.customerId);
      if (!q.ok) {
        await this.completeFailure(rowId, lease, attempts, q.errorCode, now);
        return { ...empty, outcome: "provider_error" };
      }

      // 7) upsert + 이벤트 processed를 한 트랜잭션으로. 완료 쓰기는 lease 토큰 조건(성공 역행 방지).
      const res = await this.prisma.$transaction(async (tx) => {
        const r = await this.applySnapshots(tx, mapping.userId, q.subscriptions, now, now);
        const done = await tx.subscriptionEvent.updateMany({
          where: { id: rowId, status: "processing", leaseExpiresAt: lease },
          data: { status: "processed", processedAt: now, errorCode: null, nextRetryAt: null, leaseExpiresAt: null },
        });
        if (done.count !== 1) throw new LeaseLostError(); // lease 상실 → 롤백(멱등이라 안전)
        return r;
      });
      return { outcome: res.applied > 0 ? "applied" : "noop", ...res };
    } catch (e) {
      if (e instanceof LeaseLostError) return { ...empty, outcome: "duplicate" };
      // 예외 → 실패 기록(백오프 or dead). lease 상실 시엔 조건부로 no-op.
      await this.completeFailure(rowId, lease, attempts, e instanceof Error ? e.message : "sync_failed", now);
      throw e;
    }
  }

  // 공급자 재조회 결과를 Subscription에 반영(소유권 거부·stale 펜싱·normalize). processEvent·대사 공용.
  private async applySnapshots(
    tx: Pick<PrismaService, "subscription">,
    userId: string,
    snapshots: readonly ProviderSubscriptionSnapshot[],
    now: Date,
    queryStartedAt: Date,
  ): Promise<{ applied: number; conflicts: number; skippedStale: number }> {
    let applied = 0;
    let conflicts = 0;
    let skippedStale = 0;
    for (const snap of snapshots) {
      const existingSub = await tx.subscription.findUnique({
        where: { platform_externalId: { platform: snap.platform, externalId: snap.externalId } },
        select: { id: true, userId: true, verifiedAt: true },
      });
      if (resolveOwnership(existingSub ? { userId: existingSub.userId } : null, userId) === "conflict") {
        conflicts += 1;
        continue;
      }
      if (isStaleWrite(existingSub ? { verifiedAt: existingSub.verifiedAt } : null, queryStartedAt)) {
        skippedStale += 1;
        continue;
      }
      const w = normalizeProviderSnapshot(snap, now);
      await tx.subscription.upsert({
        where: { platform_externalId: { platform: w.platform, externalId: w.externalId } },
        update: {
          userId,
          productId: w.productId,
          period: w.period,
          status: w.status,
          currentPeriodEnd: w.currentPeriodEnd,
          gracePeriodEnd: w.gracePeriodEnd,
          autoRenew: w.autoRenew,
          verifiedAt: now,
        },
        create: {
          userId,
          platform: w.platform,
          productId: w.productId,
          period: w.period,
          status: w.status,
          externalId: w.externalId,
          currentPeriodEnd: w.currentPeriodEnd,
          gracePeriodEnd: w.gracePeriodEnd,
          autoRenew: w.autoRenew,
          verifiedAt: now,
        },
      });
      applied += 1;
    }
    return { applied, conflicts, skippedStale };
  }

  // 대사(#165 Slice 3): 고객 1명 재조회 → 현재 상태 반영. 이벤트 없이 직접(사라진 구독 만료는 보류).
  async reconcileCustomer(customerId: string, now: Date): Promise<SyncResult> {
    const empty: SyncResult = { outcome: "noop", applied: 0, conflicts: 0, skippedStale: 0 };
    const mapping = await this.prisma.billingCustomer.findUnique({
      where: { provider_customerId: { provider: "REVENUECAT", customerId } },
    });
    if (!mapping) return { ...empty, outcome: "unmapped" };
    const q = await this.provider.getSubscriberState(customerId);
    if (!q.ok) return { ...empty, outcome: "provider_error" }; // 일시 오류 → 만료·강등 금지
    const res = await this.prisma.$transaction((tx) =>
      this.applySnapshots(tx, mapping.userId, q.subscriptions, now, now),
    );
    return { outcome: res.applied > 0 ? "applied" : "noop", ...res };
  }

  // 종결 skip(env_mismatch·unmapped) — lease 토큰 조건부(상실 시 no-op).
  private async completeTerminalSkip(rowId: string, lease: Date, errorCode: string): Promise<void> {
    await this.prisma.subscriptionEvent.updateMany({
      where: { id: rowId, status: "processing", leaseExpiresAt: lease },
      data: { status: "skipped", errorCode, nextRetryAt: null, leaseExpiresAt: null },
    });
  }

  // 실패 완료 — attempts<MAX면 failed+백오프, 아니면 dead(영구 종결). lease 토큰 조건부.
  private async completeFailure(
    rowId: string,
    lease: Date,
    attempts: number,
    errorCode: string | undefined,
    now: Date,
  ): Promise<void> {
    const dead = attempts >= SUBSCRIPTION_MAX_ATTEMPTS;
    await this.prisma.subscriptionEvent.updateMany({
      where: { id: rowId, status: "processing", leaseExpiresAt: lease },
      data: {
        status: dead ? "dead" : "failed",
        errorCode: errorCode ?? null,
        nextRetryAt: dead ? null : computeNextRetry(attempts, now),
        leaseExpiresAt: null,
      },
    });
  }
}
