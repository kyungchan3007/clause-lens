import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@clause-lens/ui";
import { semantic } from "@clause-lens/tokens";

import { CaptureScreen } from "../src/features/capture";

// 라우트는 얇게 — app 레이어에서 진입점(프로필)과 화면을 조합 (FSD: 상위 레이어 조합)
export default function Page() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-end px-4 py-2">
        {/* 프로필 진입 — 로그아웃은 프로필 화면 안에 있음 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="마이페이지"
          onPress={() => router.push("/profile")}
          hitSlop={12}
          className="p-1 active:opacity-60"
        >
          <Icon name="User" size={24} color={semantic.light.text} />
        </Pressable>
      </View>
      <CaptureScreen />
    </SafeAreaView>
  );
}
