import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CaptureScreen } from "../src/features/capture";
import { useAuthStore } from "../src/features/auth";

// 라우트는 얇게 — app 레이어에서 인증(로그아웃)과 화면을 조합 (FSD: 상위 레이어 조합)
export default function Page() {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row justify-end px-4 py-2">
        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          hitSlop={8}
          className="active:opacity-60"
        >
          <Text className="text-sm text-foreground-muted">로그아웃</Text>
        </Pressable>
      </View>
      <CaptureScreen />
    </SafeAreaView>
  );
}
