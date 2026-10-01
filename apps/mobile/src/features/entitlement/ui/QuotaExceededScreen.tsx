import { Pressable, Text, View } from "react-native";
import { Button, Icon, Notice } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

// 무료 분석 403(소진) 전용 화면(⑥). 표시 전용 — app이 콜백 주입.
// BrandHeader는 app이 상단에 렌더하므로 body만.
export function QuotaExceededScreen({
  onConfirm,
  onViewStatus,
}: {
  onConfirm: () => void;
  onViewStatus: () => void;
}) {
  return (
    <View className="flex-1 px-5">
      <View className="flex-1 items-center justify-center">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-3xl bg-warning-bg">
          <Icon name="Ticket" size={36} color={color("warning")} />
        </View>
        <Text
          accessibilityRole="header"
          className="text-center text-[22px] font-extrabold tracking-tight text-foreground"
        >
          무료 분석 횟수가 없어요
        </Text>
        <Text className="mt-3 max-w-[300px] text-center text-sm leading-6 text-foreground-muted">
          무료 3회를 모두 사용했어요. 진행 중인 분석이 있다면 끝난 뒤 다시 시도해 주세요.
        </Text>

        <View className="mt-7 w-full">
          <Notice tone="info" icon="Star">
            곧 구독으로 무제한 분석을 제공할 예정이에요.
          </Notice>
        </View>
      </View>

      <View className="gap-1 pb-2 pt-3">
        <Button label="확인" variant="primary" onPress={onConfirm} />
        <Pressable
          accessibilityRole="button"
          onPress={onViewStatus}
          className="items-center py-3 active:opacity-60"
        >
          <Text className="text-sm font-medium text-foreground-muted">남은 분석 상태 보기</Text>
        </Pressable>
      </View>
    </View>
  );
}
