// 구독 구매 포트(#165 Slice 4B). 공급자(RevenueCat) 결제 SDK를 추상화.
// 반환은 공급자 "성공/취소/충돌"만 — **권한이 아니다**(권한은 서버가 판정, 확인 흐름 별도).
// "서버가 진실의 기준": 구매 성공만으로 보관 권한을 부여하지 않는다.

export interface SubscriptionPlan {
  id: string; // 공급자 package/product 식별자
  title: string;
  priceLabel: string; // 공급자 제공 현지화 가격 문자열(앱이 계산하지 않음)
  period: "MONTHLY" | "YEARLY";
}

// 구매 결과(공급자 관점). conflict = 이 구매가 다른 계정에 귀속됨(스토어/공급자 신호).
export type PurchaseOutcome = "purchased" | "cancelled" | "conflict";
// 복원 결과(공급자 관점). no_target = 복원할 구매 없음. conflict = 타 계정 귀속.
export type RestoreOutcome = "restored" | "no_target" | "conflict";

export interface PurchasePort {
  // 로그인/계정 변경 시 공급자를 이 사용자로 식별. 로그아웃 시 logOut.
  configureAccount(userId: string): Promise<void>;
  logOut(): Promise<void>;
  // 판매 중 플랜 목록(공급자 offerings).
  getOfferings(): Promise<SubscriptionPlan[]>;
  // 구매/복원 — 공급자 흐름. 성공해도 권한은 서버 확인 흐름에서 판정.
  purchase(planId: string): Promise<PurchaseOutcome>;
  restore(): Promise<RestoreOutcome>;
}
