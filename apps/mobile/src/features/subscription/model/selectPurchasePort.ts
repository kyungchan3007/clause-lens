import { FakePurchases } from "./fakePurchases";
import type { PurchasePort } from "./purchasePort";
import { RevenueCatPurchases } from "./revenueCatPurchases";

// 공급자 포트 선택. **Fake는 명시적 개발 플래그에서만** — 배포에서 키/설정이 없다고 Fake로 떨어지지 않는다.
// 미설정 배포 빌드는 RevenueCatPurchases 스텁이 명확히 실패(purchases_not_configured)한다.
export function selectPurchasePort(): PurchasePort {
  if (process.env.EXPO_PUBLIC_PURCHASES_FAKE === "1") return new FakePurchases();
  return new RevenueCatPurchases();
}
