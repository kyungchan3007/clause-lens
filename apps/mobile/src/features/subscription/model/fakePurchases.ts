import type {
  PurchaseOutcome,
  PurchasePort,
  RestoreOutcome,
  SubscriptionPlan,
} from "./purchasePort";

// 개발·테스트용 Fake 공급자(#165 Slice 4B). 네이티브 없음. 결과를 주입해 앱 흐름을 검증.
// **배포에서 자동 선택 금지** — 명시적 EXPO_PUBLIC_PURCHASES_FAKE=1에서만(selectPurchasePort).
export const DEFAULT_FAKE_PLANS: SubscriptionPlan[] = [
  { id: "clauselens_pro_monthly", title: "프로 월간", priceLabel: "₩4,900/월", period: "MONTHLY" },
  { id: "clauselens_pro_yearly", title: "프로 연간", priceLabel: "₩49,000/년", period: "YEARLY" },
];

export interface FakePurchasesConfig {
  plans?: SubscriptionPlan[];
  purchaseOutcome?: PurchaseOutcome;
  restoreOutcome?: RestoreOutcome;
  failGetOfferings?: boolean;
}

export class FakePurchases implements PurchasePort {
  readonly configured: string[] = [];
  loggedOut = 0;
  constructor(private readonly config: FakePurchasesConfig = {}) {}

  async configureAccount(userId: string): Promise<void> {
    this.configured.push(userId);
  }
  async logOut(): Promise<void> {
    this.loggedOut += 1;
  }
  async getOfferings(): Promise<SubscriptionPlan[]> {
    if (this.config.failGetOfferings) throw new Error("fake_offerings_failed");
    return this.config.plans ?? DEFAULT_FAKE_PLANS;
  }
  async purchase(): Promise<PurchaseOutcome> {
    return this.config.purchaseOutcome ?? "purchased";
  }
  async restore(): Promise<RestoreOutcome> {
    return this.config.restoreOutcome ?? "restored";
  }
}
