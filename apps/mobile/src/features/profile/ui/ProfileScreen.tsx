import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "@clause-lens/ui";
import { semantic } from "@clause-lens/tokens";

import { useAuthStore } from "../../auth";
import { FaqSection } from "./FaqSection";

// provider 코드 → 사용자에게 보일 라벨.
const PROVIDER_LABEL: Record<string, string> = { KAKAO: "카카오" };

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[56px] flex-row items-center gap-3 border-b border-border bg-surface px-4 active:bg-surface-alt"
    >
      <Icon name={icon} size={20} color={semantic.light.textMuted} />
      <Text className="flex-1 text-base text-foreground">{label}</Text>
      <Icon name="ChevronRight" size={18} color={semantic.light.textMuted} />
    </Pressable>
  );
}

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const providerLabel = PROVIDER_LABEL[user?.provider ?? ""] ?? user?.provider ?? "";

  const confirmSignOut = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-10">
      {/* 내 정보 */}
      <View className="items-center gap-3 px-6 py-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-tint">
          <Icon name="User" size={40} color={semantic.light.primary} />
        </View>
        <View className="items-center gap-1">
          <Text className="text-xl font-bold text-foreground">
            {user?.displayName ?? "사용자"}
          </Text>
          {providerLabel ? (
            <Text className="text-sm text-foreground-muted">
              {providerLabel} 계정으로 로그인
            </Text>
          ) : null}
        </View>
      </View>

      {/* 자주 묻는 질문 */}
      <FaqSection />

      {/* 문의 */}
      <Text className="px-4 pb-2 pt-6 text-xs font-medium text-foreground-muted">
        문의
      </Text>
      <View className="border-t border-border">
        <MenuRow
          icon="MessageCircleQuestion"
          label="1:1 문의"
          onPress={() =>
            Alert.alert("준비 중", "1:1 문의는 곧 제공될 예정이에요.")
          }
        />
      </View>

      {/* 계정 */}
      <Text className="px-4 pb-2 pt-6 text-xs font-medium text-foreground-muted">
        계정
      </Text>
      <View className="border-t border-border">
        <Pressable
          accessibilityRole="button"
          onPress={confirmSignOut}
          className="min-h-[56px] flex-row items-center gap-3 border-b border-border bg-surface px-4 active:bg-surface-alt"
        >
          <Icon name="LogOut" size={20} color={semantic.light.danger} />
          <Text className="flex-1 text-base text-danger">로그아웃</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
