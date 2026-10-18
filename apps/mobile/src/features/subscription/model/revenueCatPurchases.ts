import type {
  PurchaseOutcome,
  PurchasePort,
  RestoreOutcome,
  SubscriptionPlan,
} from "./purchasePort";

// 실 RevenueCat 어댑터 자리(#165 Slice 4B). **네이티브 모듈 미설치** — 이 슬라이스는 Fake 기반 흐름만.
// 실 SDK 연동은 배포 전 단계(스토어 계정 준비 후): react-native-purchases 설치 + prebuild +
// 아래 메서드를 lazy require로 구현. 예:
//   const Purchases = require("react-native-purchases").default; // 최상위 import 금지(Fake/jest 보호)
// 미설정 상태에서는 **명확히 실패**한다(배포 빌드가 Fake로 조용히 대체되지 않도록).
export class RevenueCatPurchases implements PurchasePort {
  private notConfigured(): never {
    throw new Error("purchases_not_configured");
  }
  async configureAccount(_userId: string): Promise<void> {
    this.notConfigured();
  }
  async logOut(): Promise<void> {
    this.notConfigured();
  }
  async getOfferings(): Promise<SubscriptionPlan[]> {
    this.notConfigured();
  }
  async purchase(_planId: string): Promise<PurchaseOutcome> {
    this.notConfigured();
  }
  async restore(): Promise<RestoreOutcome> {
    this.notConfigured();
  }
}
