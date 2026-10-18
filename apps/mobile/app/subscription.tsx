import { router } from "expo-router";
import { Screen, ScreenHeader } from "@clause-lens/ui";

import { SubscriptionScreen } from "../src/features/subscription";

// 라우트는 얇게 — 공용 헤더 + 화면. 구독 상품·구매/복원(#165 Slice 4B).
export default function Page() {
  return (
    <Screen>
      <ScreenHeader title="프로 구독" onBack={() => router.back()} />
      <SubscriptionScreen />
    </Screen>
  );
}
