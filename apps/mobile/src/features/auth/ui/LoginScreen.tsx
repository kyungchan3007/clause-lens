import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useKakaoLogin } from "../model/useKakaoLogin";

export function LoginScreen() {
  const { signIn, loading, error } = useKakaoLogin();

  return (
    <View className="flex-1 justify-between px-6 pb-10 pt-24">
      {/* 브랜드/카피 */}
      <View className="items-center gap-3">
        <Text className="text-3xl font-bold text-foreground">ClauseLens</Text>
        <Text className="text-center text-base text-foreground-muted">
          계약서의 불리한 조항을{"\n"}촬영 한 번으로 찾아드려요
        </Text>
      </View>

      {/* 로그인 액션 */}
      <View className="gap-3">
        {error ? (
          <Text className="text-center text-sm text-danger">{error}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={signIn}
          className="h-14 items-center justify-center rounded-xl bg-[#FEE500] active:opacity-80"
        >
          {loading ? (
            <ActivityIndicator color="#191600" />
          ) : (
            <Text className="text-base font-semibold text-[#191600]">
              카카오로 시작하기
            </Text>
          )}
        </Pressable>
        <Text className="text-center text-xs text-foreground-muted">
          로그인 시 서비스 이용약관에 동의하게 됩니다
        </Text>
      </View>
    </View>
  );
}
