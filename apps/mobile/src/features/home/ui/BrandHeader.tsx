import { Pressable, Text, View } from "react-native";
import { Icon } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

// 홈 전용 상단 헤더 — 로고칩 + 브랜드명 + 프로필. 단일 사용처라 홈 feature에 둔다(공용 승격 X).
// 프로필: 48 터치 영역 안에 38 원형 시각 요소(Codex: 38 시각 ≠ 48 터치). safe area는 라우트 소유.
export function BrandHeader({ onProfile }: { onProfile: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-5 pb-1 pt-2">
      <View className="flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Icon name="ScanLine" size={15} color={color("primaryFg")} />
        </View>
        <Text className="text-lg font-extrabold text-foreground">ClauseLens</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="마이페이지"
        onPress={onProfile}
        className="h-12 w-12 items-center justify-center active:opacity-60"
      >
        <View className="h-[38px] w-[38px] items-center justify-center rounded-full border border-border bg-surface-alt">
          <Icon name="User" size={20} color={color("textMuted")} />
        </View>
      </Pressable>
    </View>
  );
}
