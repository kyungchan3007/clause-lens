import { ConflictException, Injectable } from "@nestjs/common";
import { isUniqueViolation } from "@clause-lens/db/analysis";
import type { BillingIdentifyResponse } from "@clause-lens/contracts";

import { PrismaService } from "../../db/prisma.service";
import { SubscriptionSyncService } from "../subscriptions/subscription-sync.service";

// 결제 계정 연결(#165 Slice 4A). 인증된 userId로 BillingCustomer 매핑을 멱등 생성하고,
// 최초 연결 직후 공급자 현재 상태를 재동기화(매핑 전 도착해 unmapped로 skip된 구독 흡수).
// customerId = 서버가 userId에서 파생(클라이언트 app_user_id 불신). 타 소유자 덮어쓰기 금지.
// 주의: 이 매핑은 "내부 식별"만 안전하게 한다. 구매 소유권 증명(영수증 검증/secure logIn)은 출시 전 과제.
@Injectable()
export class BillingIdentifyService {
  private static readonly PROVIDER = "REVENUECAT" as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SubscriptionSyncService,
  ) {}

  async identify(userId: string, now: Date): Promise<BillingIdentifyResponse> {
    const provider = BillingIdentifyService.PROVIDER;
    const customerId = userId; // 서버 파생(클라 입력 불신)

    // 1) 멱등 매핑 확보 — 없으면 생성, 있으면 재사용. 타 소유자면 거부(재할당 금지·방어선).
    const existing = await this.prisma.billingCustomer.findUnique({
      where: { provider_customerId: { provider, customerId } },
    });
    let mappingCreated = false;
    if (!existing) {
      try {
        await this.prisma.billingCustomer.create({ data: { userId, provider, customerId } });
        mappingCreated = true;
      } catch (e) {
        // 동시 생성 레이스(P2002)는 피어가 만든 것 → 무해(created=false). 그 외는 전파.
        if (!isUniqueViolation(e)) throw e;
      }
    } else if (existing.userId !== userId) {
      throw new ConflictException("billing_customer_owned_by_another");
    }

    // 2) 최초 연결 직후 재동기화 — 매핑 전 도착한 구독을 지금 반영(공급자 미연결/실패면 no-op, 안전).
    const result = await this.sync.reconcileCustomer(customerId, now);
    const outcome =
      result.outcome === "applied" ||
      result.outcome === "unmapped" ||
      result.outcome === "provider_error"
        ? result.outcome
        : "noop";

    return { customerId, mappingCreated, synced: { outcome, applied: result.applied } };
  }
}
