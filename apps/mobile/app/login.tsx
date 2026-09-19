import { SafeAreaView } from "react-native-safe-area-context";

import { LoginScreen } from "../src/features/auth";

// 라우트는 얇게 — 화면만 렌더 (FSD: app 레이어)
export default function Page() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <LoginScreen />
    </SafeAreaView>
  );
}
