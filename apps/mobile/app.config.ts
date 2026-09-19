import type { ConfigContext, ExpoConfig } from "expo/config";

// 정적 값은 app.json에 유지하고, env 의존(카카오 네이티브 키) 부분만 여기서 주입한다.
// Expo가 .env(apps/mobile/.env)를 먼저 로드하므로 prebuild/run 시 process.env로 접근 가능.
// CI/빌드에서 .env가 없어도 config 평가가 중단되지 않도록 폴백을 둔다.
// (하드 throw 시 #22 CI의 prebuild/expo-doctor가 전부 실패.) 실제 로그인은
// 유효한 키가 필요하므로, 누락 시 눈에 띄게 경고만 남기고 placeholder로 진행.
const KAKAO_KEY_PLACEHOLDER = "kakao-native-app-key-missing";
const KAKAO_NATIVE_APP_KEY =
  process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY ?? KAKAO_KEY_PLACEHOLDER;
// 프로덕션(EAS production 프로파일) 빌드는 placeholder로 나가지 않도록 강제 실패.
// dev/CI는 경고만(빌드 차단 방지), 릴리스는 잘못된 키 배포 차단.
const IS_PRODUCTION_BUILD = process.env.EAS_BUILD_PROFILE === "production";

export default ({ config }: ConfigContext): ExpoConfig => {
  if (KAKAO_NATIVE_APP_KEY === KAKAO_KEY_PLACEHOLDER) {
    if (IS_PRODUCTION_BUILD) {
      throw new Error(
        "[app.config] 프로덕션 빌드에 EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY 누락 — " +
          "placeholder 배포 차단. Railway/EAS env에 키 설정 필요.",
      );
    }
    console.warn(
      "[app.config] EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY 누락 — placeholder로 빌드(개발/CI). " +
        "실제 카카오 로그인은 동작하지 않음. apps/mobile/.env 설정 필요(.env.example 참고).",
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
