import "../global.css";
import "react-native-gesture-handler";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { initializeKakaoSDK } from "@react-native-kakao/core";

import { useAuthStore } from "../src/features/auth";

// 카카오 SDK는 앱 시작 시 1회 초기화(네이티브 앱 키는 client-public, env 주입).
const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
if (kakaoNativeAppKey) {
  initializeKakaoSDK(kakaoNativeAppKey);
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthGate />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// 인증 게이트 3상태: 복원 중(스플래시) → 인증(capture) / 비인증(login).
function AuthGate() {
  const status = useAuthStore((s) => s.status);
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  if (status === "restoring") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === "authenticated"}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={status === "unauthenticated"}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
