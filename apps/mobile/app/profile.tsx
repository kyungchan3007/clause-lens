import { router } from "expo-router";
import { Screen, ScreenHeader } from "@clause-lens/ui";

import { ProfileScreen } from "../src/features/profile";

// 라우트는 얇게 — 커스텀 헤더(ScreenHeader) + 화면. 네이티브 Stack 헤더 대신 앱 내 일관 헤더.
// Screen(SafeAreaView) 필수: headerShown:false라 상태바/노치 inset을 직접 처리(없으면 헤더가 겹침).
export default function Page() {
  return (
    <Screen>
      <ScreenHeader title="마이페이지" onBack={() => router.back()} />
      <ProfileScreen />
    </Screen>
  );
}
