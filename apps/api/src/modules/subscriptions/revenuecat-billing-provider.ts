import { Injectable } from "@nestjs/common";
import {
  deriveSubscriptionStatus,
  storeToPlatform,
  type ProviderSubscriptionSnapshot,
  type SubscriptionPeriod,
} from "@clause-lens/db/analysis";

import type { BillingProviderPort, ProviderQueryResult } from "./billing-provider.port";

// RevenueCat REST v1 어댑터(#165 Slice 2). "웹훅=재조회 트리거"의 재조회 구현.
// 서버 인스턴스는 단일 환경(production|sandbox)에 바인딩 — 환경 혼선/레이스 회피(Codex 리뷰).
export interface RevenueCatAdapterConfig {
  secretKey: string;
  apiBase: string; // 보통 https://api.revenuecat.com
  environment: "production" | "sandbox";
  timeoutMs: number;
  // productId → 기간. 길이 추정 대신 레지스트리로 결정(미등록 product는 skip).
  productPeriods: Readonly<Record<string, SubscriptionPeriod>>;
}

// 계획 product id(스토어 설정 시 확정). env REVENUECAT_PRODUCT_PERIODS(JSON)로 덮어쓸 수 있음.
export const DEFAULT_PRODUCT_PERIODS: Readonly<Record<string, SubscriptionPeriod>> = {
  clauselens_pro: "MONTHLY",
  clauselens_pro_monthly: "MONTHLY",
  clauselens_pro_yearly: "YEARLY",
};

// 응답에서 필요한 부분만(느슨 — 모르는 필드는 무시).
interface RcSubscriptionEntry {
  store?: string | null;
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  unsubscribe_detected_at?: string | null;
}
interface RcSubscriberResponse {
  subscriber?: { subscriptions?: Record<string, RcSubscriptionEntry> };
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class RevenueCatBillingProvider implements BillingProviderPort {
  constructor(private readonly config: RevenueCatAdapterConfig) {}

  async getSubscriberState(customerId: string): Promise<ProviderQueryResult> {
    const now = new Date();
    const url = `${this.config.apiBase}/v1/subscribers/${encodeURIComponent(customerId)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.secretKey}`,
      Accept: "application/json",
    };
    // 서버가 sandbox 환경일 때만 sandbox 거래 포함(기본은 제외됨).
    if (this.config.environment === "sandbox") headers["X-Is-Sandbox"] = "true";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(url, { method: "GET", headers, signal: controller.signal });
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      return { ok: false, errorCode: aborted ? "provider_timeout" : "provider_unreachable" };
    } finally {
      clearTimeout(timer);
    }

    // 비2xx는 ok:false — "구독 없음"으로 단정해 기존 active를 만료시키지 않는다.
    // 404는 별도 errorCode(customer_not_found)로 구분해 관측·후속 분기 가능(SDD). 모두 ok:false라
    // 반영/만료는 일으키지 않고, 재시도는 Slice 3 백오프+dead-letter로 bounded(무한 루프 아님).
    if (!res.ok) {
      const errorCode = res.status === 404 ? "customer_not_found" : `provider_http_${res.status}`;
      return { ok: false, errorCode };
    }

    let body: RcSubscriberResponse;
    try {
      body = (await res.json()) as RcSubscriberResponse;
    } catch {
      return { ok: false, errorCode: "provider_bad_json" };
    }

    const subs = body.subscriber?.subscriptions ?? {};
    const snapshots: ProviderSubscriptionSnapshot[] = [];
    for (const [productId, entry] of Object.entries(subs)) {
      const platform = storeToPlatform(entry.store);
      if (platform === null) continue; // 지원 밖 store skip
      const period = this.config.productPeriods[productId];
      if (period == null) continue; // 미등록 product skip(기간 추정 금지)
      const expiresAt = parseDate(entry.expires_date);
      const graceAt = parseDate(entry.grace_period_expires_date);
      const status = deriveSubscriptionStatus(expiresAt, graceAt, now);
      if (status === null || expiresAt === null) continue; // currentPeriodEnd 불가 skip
      snapshots.push({
        platform,
        productId,
        period,
        // RC v1 실제 단위 = (고객 × 상품). 교차사용자 이전·병합은 Slice 5(소유권 충돌 거부가 가드).
        externalId: `${customerId}:${productId}`,
        status,
        currentPeriodEnd: expiresAt,
        gracePeriodEnd: status === "grace" ? graceAt : null,
        // best-effort(권한 판정엔 미사용 — status/expiry가 기준).
        autoRenew: entry.unsubscribe_detected_at == null,
        environment: this.config.environment,
      });
    }
    return { ok: true, subscriptions: snapshots };
  }
}
