import { Inject, Injectable } from "@nestjs/common";
import { isStaleWrite, normalizeProviderSnapshot, resolveOwnership } from "@clause-lens/db/analysis";

import { PrismaService } from "../../db/prisma.service";
import { BILLING_PROVIDER, type BillingProviderPort } from "./billing-provider.port";

// 공급자가 보낸 이벤트(수신함에 넣기 전 정규화된 입력). 실제 웹훅 파싱·인증은 Slice 2.
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
  | "duplicate" // 이미 수신된 이벤트 — 멱등 no-op
  | "unmapped" // 고객 매핑 없음 → 귀속 불가(기록만)
  | "provider_error" // 재조회 실패 → 기존 상태 유지
  | "applied" // 1건 이상 반영
  | "noop"; // 반영할 변화 없음(stale/빈 상태/전부 충돌)

export interface SyncResult {
  outcome: SyncOutcome;
  applied: number;
  conflicts: number;
  skippedStale: number;
}

// 결제 이벤트 → 수신함 멱등 저장 → 공급자 재조회 → Subscription 반영.
// 설계: ADR-12 + Codex 2026-10-15. 웹훅=트리거, 행=검증된 현재 상태의 투영. 운영 라우트는 Slice 2.
@Injectable()
export class SubscriptionSyncService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProviderPort,
  ) {}

  async processEvent(evt: IncomingSubscriptionEvent, now: Date): Promise<SyncResult> {
    const empty: SyncResult = { outcome: "noop", applied: 0, conflicts: 0, skippedStale: 0 };

    // 1) 수신함 멱등 — 같은 (provider, projectId, eventId)면 중복(no-op).
    const dup = await this.prisma.subscriptionEvent.findUnique({
      where: {
        provider_projectId_eventId: {
          provider: evt.provider,
          projectId: evt.projectId,
          eventId: evt.eventId,
        },
      },
    });
    if (dup) return { ...empty, outcome: "duplicate" };

    const row = await this.prisma.subscriptionEvent.create({
      data: {
        provider: evt.provider,
        projectId: evt.projectId,
        eventId: evt.eventId,
        type: evt.type,
        environment: evt.environment,
        occurredAt: evt.occurredAt,
        status: "processing",
        payload: evt.payload as object,
      },
    });
    const finish = (status: "processed" | "failed" | "skipped", errorCode?: string) =>
      this.prisma.subscriptionEvent.update({
        where: { id: row.id },
        data: {
          status,
          errorCode: errorCode ?? null,
          processedAt: status === "processed" ? now : null,
          attempts: { increment: 1 },
        },
      });

    // 2) 고객 → userId (매핑 없으면 귀속 불가 → 기록만)
    const mapping = await this.prisma.billingCustomer.findUnique({
      where: { provider_customerId: { provider: evt.provider, customerId: evt.customerId } },
    });
    if (!mapping) {
      await finish("skipped", "unmapped_customer");
      return { ...empty, outcome: "unmapped" };
    }
    const userId = mapping.userId;

    // 3) 공급자 현재 상태 재조회 — 실패면 기존 유지(신규 권한·기간 연장 금지).
    const queryStartedAt = now;
    const q = await this.provider.getSubscriberState(evt.customerId);
    if (!q.ok) {
      await finish("failed", q.errorCode);
      return { ...empty, outcome: "provider_error" };
    }

    let applied = 0;
    let conflicts = 0;
    let skippedStale = 0;

    for (const snap of q.subscriptions) {
      const existing = await this.prisma.subscription.findUnique({
        where: { platform_externalId: { platform: snap.platform, externalId: snap.externalId } },
        select: { id: true, userId: true, verifiedAt: true },
      });

      // 소유권: 타 사용자로의 귀속 변경 거부(자동 이관·병합 금지). 충돌은 건너뜀(알림은 Slice 3).
      if (resolveOwnership(existing ? { userId: existing.userId } : null, userId) === "conflict") {
        conflicts += 1;
        continue;
      }
      // 펜싱: 조회 시작 이후 더 최신 쓰기가 있었다면 이 쓰기는 버린다.
      if (isStaleWrite(existing ? { verifiedAt: existing.verifiedAt } : null, queryStartedAt)) {
        skippedStale += 1;
        continue;
      }

      const w = normalizeProviderSnapshot(snap, now);
      await this.prisma.subscription.upsert({
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

    await finish("processed");
    return { outcome: applied > 0 ? "applied" : "noop", applied, conflicts, skippedStale };
  }
}
