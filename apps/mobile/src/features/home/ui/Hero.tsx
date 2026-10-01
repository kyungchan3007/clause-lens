import { Text, View } from "react-native";
import { Icon } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

// 홈 온보딩 히어로(홈 전용) — 공용 EmptyState보다 큰 치수(96 tint 박스·26 제목). 시안 Main.
export function Hero() {
  return (
    <View className="items-center px-7 pb-2 pt-6">
      <View className="mb-5 h-24 w-24 items-center justify-center rounded-3xl bg-primary-tint">
        <Icon name="ShieldCheck" size={40} color={color("text")} />
      </View>
      <Text className="text-center text-2xl font-extrabold text-foreground">계약서, 찍기만 하세요</Text>
      <Text className="mt-3 max-w-[260px] text-center text-[15px] leading-6 text-foreground-muted">
        불리할 수 있는 조항을 찾아 사진 위에 표시해 드려요.
      </Text>
    </View>
  );
}
