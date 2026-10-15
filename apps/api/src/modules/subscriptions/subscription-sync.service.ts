import { Inject, Injectable } from "@nestjs/common";
import {
  isStaleWrite,
  isUniqueViolation,
  normalizeProviderSnapshot,
  resolveOwnership,
} from "@clause-lens/db/analysis";

import { PrismaService } from "../../db/prisma.service";
import { BILLING_PROVIDER, type BillingProviderPort } from "./billing-provider.port";

// 이 서버 인스턴스가 처리할 환경(production|sandbox). 다른 환경 이벤트는 skip(sandbox가 운영 행 덮기 방지).
export const SUBSCRIPTION_SYNC_ENVIRONMENT = "SUBSCRIPTION_SYNC_ENVIRONMENT";

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
  | "duplicate" // 이미 성공 처리(processed)된 이벤트 — 멱등 no-op
  | "unmapped" // 고객 매핑 없음 → 귀속 불가(기록만)
  | "skipped" // 이 서버 환경과 다른 이벤트 등 — 의도적 미반영(기록만)
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
// 설계: ADR-12 + Codex(2026-10-15 Slice 1·2). 웹훅=트리거, 행=검증된 현재 상태의 투영.
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

    // 1) 수신함 조회 — **성공(processed) 종결만 중복 no-op**. received/failed/skipped는 재처리
    //    (라이브 재시도에서 실패 이벤트가 '이미 있음'으로 성공처럼 종결되는 버그 방지 — Codex A).
    const existing = await this.prisma.subscriptionEvent.findUnique({ where: key });
    if (existing?.status === "processed") return { ...empty, outcome: "duplicate" };

    // 2) 행 확보 — 신규는 create(received), 동시 생성 레이스(P2002)면 재조회(그새 processed면 duplicate).
    let row: { id: string };
    if (existing) {
      row = { id: existing.id };
    } else {
      try {
        row = await this.prisma.subscriptionEvent.create({
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
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        const again = await this.prisma.subscriptionEvent.findUnique({ where: key });
        if (!again) throw e;
        if (again.status === "processed") return { ...empty, outcome: "duplicate" };
        row = { id: again.id };
      }
    }

    const mark = (status: "processed" | "failed" | "skipped", errorCode?: string) =>
      this.prisma.subscriptionEvent.update({
        where: { id: row.id },
        data: {
          status,
          errorCode: errorCode ?? null,
          processedAt: status === "processed" ? now : null,
          attempts: { increment: 1 },
        },
      });

    try {
      // 3) 환경 게이트 — 이 서버가 처리하는 환경과 다르면 기록만(운영 서버는 sandbox 배제).
      if (evt.environment !== this.expectedEnvironment) {
        await mark("skipped", "env_mismatch");
        return { ...empty, outcome: "skipped" };
      }

      // 4) 고객 → userId. 매핑 없으면 귀속 불가(기록만). **웹훅으로 매핑 생성 금지**(소유권 미증명 — Slice 4).
      const mapping = await this.prisma.billingCustomer.findUnique({
        where: { provider_customerId: { provider: evt.provider, customerId: evt.customerId } },
      });
      if (!mapping) {
        await mark("skipped", "unmapped_customer");
        return { ...empty, outcome: "unmapped" };
      }
      const userId = mapping.userId;

      // 5) 공급자 현재 상태 재조회 — 외부 호출(트랜잭션 밖). 실패면 기존 유지(5xx로 RC 재시도 유도).
      const queryStartedAt = now;
      const q = await this.provider.getSubscriberState(evt.customerId);
      if (!q.ok) {
        await mark("failed", q.errorCode);
        return { ...empty, outcome: "provider_error" };
      }

      // 6) 모든 upsert + 이벤트 processed를 하나의 트랜잭션으로 원자 반영(부분 적용 방지).
      const res = await this.prisma.$transaction(async (tx) => {
        let applied = 0;
        let conflicts = 0;
        let skippedStale = 0;
        for (const snap of q.subscriptions) {
          const existingSub = await tx.subscription.findUnique({
            where: { platform_externalId: { platform: snap.platform, externalId: snap.externalId } },
            select: { id: true, userId: true, verifiedAt: true },
          });
          // 소유권: 타 사용자로의 귀속 변경 거부(자동 이관·병합 금지). 충돌은 건너뜀(알림은 Slice 3).
          if (resolveOwnership(existingSub ? { userId: existingSub.userId } : null, userId) === "conflict") {
            conflicts += 1;
            continue;
          }
          // 펜싱: 조회 시작 이후 더 최신 쓰기가 있었다면 이 쓰기는 버린다.
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
        await tx.subscriptionEvent.update({
          where: { id: row.id },
          data: { status: "processed", processedAt: now, attempts: { increment: 1 } },
        });
        return { applied, conflicts, skippedStale };
      });

      return { outcome: res.applied > 0 ? "applied" : "noop", ...res };
    } catch (e) {
      // 예외 시 이벤트를 failed로 확실히 기록(received/processing 잔류·재처리 불가 방지). 재시도는 Slice 3.
      await mark("failed", e instanceof Error ? e.message : "sync_failed");
      throw e;
    }
  }
}
