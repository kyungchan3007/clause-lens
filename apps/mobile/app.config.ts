import type { ConfigContext, ExpoConfig } from "expo/config";

// 정적 값은 app.json에 유지하고, env 의존(카카오 네이티브 키) 부분만 여기서 주입한다.
// Expo가 .env(apps/mobile/.env)를 먼저 로드하므로 prebuild/run 시 process.env로 접근 가능.
const KAKAO_NATIVE_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!KAKAO_NATIVE_APP_KEY) {
    throw new Error(
      "[app.config] EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY 누락 — apps/mobile/.env 확인 (.env.example 참고)",
    );
  }

  return {
    ...config,
    // ConfigContext.config는 name/slug가 optional 타입이라 보강(app.json에서 옴).
    name: config.name ?? "clause-lens",
    slug: config.slug ?? "clause-lens",
    plugins: [
      ...(config.plugins ?? []),
      "expo-secure-store",
      [
        "@react-native-kakao/core",
        {
          // 네이티브 앱 키(client-public). iOS URL 스킴 kakao{키} + AppDelegate open-url 핸들 생성.
          nativeAppKey: KAKAO_NATIVE_APP_KEY,
          android: { authCodeHandlerActivity: true },
          ios: { handleKakaoOpenUrl: true },
        },
      ],
    ],
  };
};
