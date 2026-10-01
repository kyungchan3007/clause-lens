import "../global.css";
import "react-native-gesture-handler";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { initializeKakaoSDK } from "@react-native-kakao/core";

import { useAuthStore } from "../src/features/auth";
import { useEntitlementSync } from "../src/features/entitlement";
import { useDocumentsSync } from "../src/features/documents";
import { ThemeProvider } from "../src/shared/theme";

// 카카오 SDK는 앱 시작 시 1회 초기화(네이티브 앱 키는 client-public, env 주입).
const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
if (kakaoNativeAppKey) {
  initializeKakaoSDK(kakaoNativeAppKey);
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthGate />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// 인증 게이트 3상태: 복원 중(스플래시) → 인증(capture) / 비인증(login).
function AuthGate() {
  const status = useAuthStore((s) => s.status);
  const restore = useAuthStore((s) => s.restore);

  // 인증·분석 변화에 맞춰 무료 잔량 동기화(기능 간 결합을 이 상위 레이어 한 곳에).
  useEntitlementSync();
  // 인증·분석 완료에 맞춰 재열람 문서 목록 동기화.
  useDocumentsSync();

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
        <Stack.Screen
          name="profile"
          options={{ headerShown: true, title: "마이페이지", headerBackTitle: "뒤로" }}
        />
        <Stack.Screen name="result" />
        <Stack.Screen name="recent" />
      </Stack.Protected>
      <Stack.Protected guard={status === "unauthenticated"}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
