import type { AccessResponse, BillingIdentifyResponse } from "@clause-lens/contracts";

import { FakePurchases } from "./fakePurchases";
import type { PurchaseOutcome, RestoreOutcome } from "./purchasePort";
import { useSubscriptionStore } from "./subscriptionStore";

jest.mock("../api/billingApi", () => ({
  identify: jest.fn(),
  fetchAccess: jest.fn(),
}));
jest.mock("../../auth", () => ({ getAccessToken: jest.fn() }));

import { fetchAccess, identify } from "../api/billingApi";
import { getAccessToken } from "../../auth";

const mockIdentify = identify as jest.MockedFunction<typeof identify>;
const mockAccess = fetchAccess as jest.MockedFunction<typeof fetchAccess>;
const mockToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;

const access = (over: Partial<AccessResponse> = {}): AccessResponse => ({
  storage: { canSave: false },
  analysis: { source: "free", remaining: 3, monthlyQuota: 3 },
  ...over,
});
const identifyRes = (over: Partial<BillingIdentifyResponse> = {}): BillingIdentifyResponse => ({
  customerId: "u1",
  mappingCreated: false,
  synced: { outcome: "noop", applied: 0 },
  ...over,
});

function setupFake(cfg: { purchaseOutcome?: PurchaseOutcome; restoreOutcome?: RestoreOutcome } = {}) {
  const fake = new FakePurchases(cfg);
  useSubscriptionStore.setState({
    generation: 0,
    userId: null,
    offeringsStatus: "idle",
    plans: [],
    flow: "idle",
    inFlight: false,
    _wait: async () => undefined,
    _timing: { baseMs: 0, maxAttempts: 3, deadlineMs: 1_000_000 },
  });
  useSubscriptionStore.getState().__configureForTest({ _port: fake });
  return fake;
}

beforeEach(() => {
  mockToken.mockReset().mockResolvedValue("tok");
  mockIdentify.mockReset().mockResolvedValue(identifyRes());
  mockAccess.mockReset().mockResolvedValue(access());
});

describe("subscriptionStore — 구매 확인 상태기계", () => {
  it("구매 성공 + 권한 반영 → active", async () => {
    setupFake({ purchaseOutcome: "purchased" });
    mockAccess.mockResolvedValue(access({ storage: { canSave: true } }));
    await useSubscriptionStore.getState().purchase("p1");
    expect(useSubscriptionStore.getState().flow).toBe("active");
    expect(mockIdentify).toHaveBeenCalled(); // 재동기화 트리거
  });

  it("구매 성공했지만 서버 반영 확인 안 됨 → delayed(상한 후)", async () => {
    setupFake({ purchaseOutcome: "purchased" });
    mockAccess.mockResolvedValue(access()); // 계속 free
    await useSubscriptionStore.getState().purchase("p1");
    expect(useSubscriptionStore.getState().flow).toBe("delayed");
  });

  it("기존 구독자 추가 구매(access 이미 canSave) → active (멱등 applied=0여도)", async () => {
    setupFake({ purchaseOutcome: "purchased" });
    mockIdentify.mockResolvedValue(identifyRes({ synced: { outcome: "noop", applied: 0 } }));
    mockAccess.mockResolvedValue(access({ analysis: { source: "subscription", remaining: 50, monthlyQuota: 50 } }));
    await useSubscriptionStore.getState().purchase("p1");
    expect(useSubscriptionStore.getState().flow).toBe("active");
  });

  it("구매 취소 → cancelled (서버 호출 없음)", async () => {
    setupFake({ purchaseOutcome: "cancelled" });
    await useSubscriptionStore.getState().purchase("p1");
    expect(useSubscriptionStore.getState().flow).toBe("cancelled");
    expect(mockIdentify).not.toHaveBeenCalled();
  });

  it("구매 충돌(타 계정) → conflict", async () => {
    setupFake({ purchaseOutcome: "conflict" });
    await useSubscriptionStore.getState().purchase("p1");
    expect(useSubscriptionStore.getState().flow).toBe("conflict");
  });

  it("복원 대상 없음 → no_target", async () => {
    setupFake({ restoreOutcome: "no_target" });
    await useSubscriptionStore.getState().restore();
    expect(useSubscriptionStore.getState().flow).toBe("no_target");
  });

  it("복원 성공 + 권한 반영 → active", async () => {
    setupFake({ restoreOutcome: "restored" });
    mockAccess.mockResolvedValue(access({ storage: { canSave: true } }));
    await useSubscriptionStore.getState().restore();
    expect(useSubscriptionStore.getState().flow).toBe("active");
  });

  it("delayed에서 recheck → 재확인(재구매 아님) → active", async () => {
    const fake = setupFake({ purchaseOutcome: "purchased" });
    mockAccess.mockResolvedValue(access()); // 먼저 free → delayed
    await useSubscriptionStore.getState().purchase("p1");
    expect(useSubscriptionStore.getState().flow).toBe("delayed");
    const purchaseSpy = jest.spyOn(fake, "purchase");
    mockAccess.mockResolvedValue(access({ storage: { canSave: true } }));
    await useSubscriptionStore.getState().recheck();
    expect(useSubscriptionStore.getState().flow).toBe("active");
    expect(purchaseSpy).not.toHaveBeenCalled(); // 재구매 안 함
  });

  it("single-flight — 진행 중 두 번째 구매 무시", async () => {
    const fake = setupFake({ purchaseOutcome: "purchased" });
    const spy = jest.spyOn(fake, "purchase");
    const p1 = useSubscriptionStore.getState().purchase("p1");
    const p2 = useSubscriptionStore.getState().purchase("p1"); // inFlight → 무시
    await Promise.all([p1, p2]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("구매 중 계정 전환 → 결과 폐기(active로 안 감)", async () => {
    const fake = new FakePurchases();
    useSubscriptionStore.setState({
      generation: 0, userId: "u1", offeringsStatus: "idle", plans: [], flow: "idle", inFlight: false,
      _wait: async () => undefined, _timing: { baseMs: 0, maxAttempts: 3, deadlineMs: 1_000_000 },
    });
    // purchase 도중 계정이 바뀌도록 — port.purchase가 syncAccount("u2") 호출
    const racingPort = {
      ...fake,
      configureAccount: async () => undefined,
      logOut: async () => undefined,
      getOfferings: async () => [],
      restore: async () => "restored" as const,
      purchase: async (): Promise<PurchaseOutcome> => {
        useSubscriptionStore.getState().syncAccount("u2"); // 세대 증가
        return "purchased";
      },
    };
    useSubscriptionStore.getState().__configureForTest({ _port: racingPort });
    mockAccess.mockResolvedValue(access({ storage: { canSave: true } }));
    await useSubscriptionStore.getState().purchase("p1");
    expect(useSubscriptionStore.getState().flow).not.toBe("active"); // 이전 계정 결과 폐기
  });
});

describe("subscriptionStore — 계정 동기화", () => {
  it("userId 설정 → 공급자 configure, 로그아웃 → logOut, 세대 증가", async () => {
    const fake = setupFake();
    useSubscriptionStore.getState().syncAccount("u1");
    await Promise.resolve();
    expect(fake.configured).toContain("u1");
    const genAfterLogin = useSubscriptionStore.getState().generation;
    useSubscriptionStore.getState().syncAccount(null);
    await Promise.resolve();
    expect(fake.loggedOut).toBe(1);
    expect(useSubscriptionStore.getState().generation).toBeGreaterThan(genAfterLogin);
  });
});

describe("subscriptionStore — offerings", () => {
  it("로드 성공 → plans/ready", async () => {
    setupFake();
    await useSubscriptionStore.getState().loadOfferings();
    expect(useSubscriptionStore.getState().offeringsStatus).toBe("ready");
    expect(useSubscriptionStore.getState().plans.length).toBeGreaterThan(0);
  });

  it("로드 실패 → error", async () => {
    const fake = new FakePurchases({ failGetOfferings: true });
    setupFake();
    useSubscriptionStore.getState().__configureForTest({ _port: fake });
    await useSubscriptionStore.getState().loadOfferings();
    expect(useSubscriptionStore.getState().offeringsStatus).toBe("error");
  });
});
