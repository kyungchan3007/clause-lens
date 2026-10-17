import {
  RevenueCatBillingProvider,
  type RevenueCatAdapterConfig,
} from "./revenuecat-billing-provider";

const FUTURE = "2999-01-01T00:00:00Z";
const PAST = "2000-01-01T00:00:00Z";

const baseConfig: RevenueCatAdapterConfig = {
  secretKey: "sk_test",
  apiBase: "https://api.revenuecat.com",
  environment: "production",
  timeoutMs: 1000,
  productPeriods: { clauselens_pro: "MONTHLY", clauselens_pro_yearly: "YEARLY" },
};

function mockFetch(impl: (url: string, init: RequestInit) => unknown): jest.Mock {
  const fn = jest.fn(async (url: string, init: RequestInit) => impl(url, init));
  (global as unknown as { fetch: unknown }).fetch = fn;
  return fn as unknown as jest.Mock;
}

function okJson(subscriptions: Record<string, unknown>) {
  return { ok: true, status: 200, json: async () => ({ subscriber: { subscriptions } }) };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("RevenueCatBillingProvider.getSubscriberState", () => {
  it("active 구독 → PLAY·MONTHLY·active·externalId=cust:product", async () => {
    mockFetch(() =>
      okJson({ clauselens_pro: { store: "play_store", expires_date: FUTURE, unsubscribe_detected_at: null } }),
    );
    const p = new RevenueCatBillingProvider(baseConfig);
    const r = await p.getSubscriberState("cust_1");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.subscriptions).toHaveLength(1);
    const s = r.subscriptions[0];
    expect(s).toMatchObject({
      platform: "PLAY",
      period: "MONTHLY",
      status: "active",
      externalId: "cust_1:clauselens_pro",
      autoRenew: true,
      environment: "production",
    });
  });

  it("만료 후 유예 → grace", async () => {
    mockFetch(() =>
      okJson({ clauselens_pro: { store: "play_store", expires_date: PAST, grace_period_expires_date: FUTURE } }),
    );
    const r = await new RevenueCatBillingProvider(baseConfig).getSubscriberState("c");
    if (!r.ok) throw new Error("expected ok");
    expect(r.subscriptions[0].status).toBe("grace");
  });

  it("만료·유예 없음 → expired", async () => {
    mockFetch(() => okJson({ clauselens_pro: { store: "play_store", expires_date: PAST } }));
    const r = await new RevenueCatBillingProvider(baseConfig).getSubscriberState("c");
    if (!r.ok) throw new Error("expected ok");
    expect(r.subscriptions[0].status).toBe("expired");
  });

  it("지원 밖 store(amazon) → skip", async () => {
    mockFetch(() => okJson({ clauselens_pro: { store: "amazon", expires_date: FUTURE } }));
    const r = await new RevenueCatBillingProvider(baseConfig).getSubscriberState("c");
    if (!r.ok) throw new Error("expected ok");
    expect(r.subscriptions).toHaveLength(0);
  });

  it("미등록 product → skip (기간 추정 금지)", async () => {
    mockFetch(() => okJson({ unknown_product: { store: "play_store", expires_date: FUTURE } }));
    const r = await new RevenueCatBillingProvider(baseConfig).getSubscriberState("c");
    if (!r.ok) throw new Error("expected ok");
    expect(r.subscriptions).toHaveLength(0);
  });

  it("빈 subscriptions → ok:true []", async () => {
    mockFetch(() => okJson({}));
    const r = await new RevenueCatBillingProvider(baseConfig).getSubscriberState("c");
    expect(r).toEqual({ ok: true, subscriptions: [] });
  });

  it("404 → ok:false (customer_not_found, 구독 없음으로 단정 안 함)", async () => {
    mockFetch(() => ({ ok: false, status: 404, json: async () => ({}) }));
    const r = await new RevenueCatBillingProvider(baseConfig).getSubscriberState("c");
    expect(r).toEqual({ ok: false, errorCode: "customer_not_found" });
  });

  it("기타 비2xx(500) → ok:false provider_http_500", async () => {
    mockFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));
    const r = await new RevenueCatBillingProvider(baseConfig).getSubscriberState("c");
    expect(r).toEqual({ ok: false, errorCode: "provider_http_500" });
  });

  it("네트워크 오류 → ok:false provider_unreachable", async () => {
    mockFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    const r = await new RevenueCatBillingProvider(baseConfig).getSubscriberState("c");
    expect(r).toEqual({ ok: false, errorCode: "provider_unreachable" });
  });

  it("sandbox 환경 → X-Is-Sandbox 헤더 + Bearer secret", async () => {
    const fn = mockFetch(() => okJson({}));
    await new RevenueCatBillingProvider({ ...baseConfig, environment: "sandbox" }).getSubscriberState("cust_x");
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.revenuecat.com/v1/subscribers/cust_x");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Is-Sandbox"]).toBe("true");
    expect(headers.Authorization).toBe("Bearer sk_test");
  });
});
