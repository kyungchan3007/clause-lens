import { Text, View } from "react-native";
import { Button, Icon } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

// 최근 목록(⑨) 하단 구독 안내 카드. 이동은 라우트가 주입(onPress) — 피처는 네비게이션 비의존.
export function SubscriptionPromoCard({ onPress }: { onPress: () => void }) {
  return (
    <View className="gap-2.5 rounded-2xl bg-primary-tint p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="ShieldCheck" size={18} color={color("primary")} />
        <Text className="text-[15px] font-bold text-foreground">분석 결과를 계속 보관하세요</Text>
      </View>
      <Text className="text-[13px] leading-5 text-foreground-muted">
        무료 결과는 7일 뒤 사라져요. 구독하면 기한 없이 보관하고 언제든 다시 볼 수 있어요.
      </Text>
      <Button label="구독 알아보기" variant="primary" fullWidth onPress={onPress} />
    </View>
  );
}
