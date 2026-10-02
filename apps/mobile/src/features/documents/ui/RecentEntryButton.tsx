import { Pressable, Text, View } from "react-native";
import { Icon, LoadingIndicator, RetryInline } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

import { useDocumentsStore } from "../model/documentsStore";

// 홈 '최근있음' 진입 버튼 — 인라인 미리보기 대신, 원할 때 /recent 전체 화면으로.
// 로딩=스피너·에러=다시 시도·0건=null(온보딩이 처리)·N건=「최근 분석 N건 >」.
export function RecentEntryButton({ onSeeAll }: { onSeeAll: () => void }) {
  const status = useDocumentsStore((s) => s.status);
  const count = useDocumentsStore((s) => s.items.length);
  const refresh = useDocumentsStore((s) => s.refresh);

  if (status === "loading") {
    return (
      <View className="px-5 pt-2">
        <View className="items-center rounded-2xl border border-border bg-surface py-4">
          <LoadingIndicator label="불러오는 중" />
        </View>
      </View>
    );
  }
  if (status === "error") {
    return (
      <View className="px-5 pt-2">
        <RetryInline
          onRetry={() => void refresh()}
          label="최근 분석을 불러오지 못했어요 · 다시 시도"
          className="items-center rounded-2xl border border-border bg-surface py-4 active:opacity-70"
        />
      </View>
    );
  }
  if (count === 0) return null; // ready & 0건 = 온보딩이 담당

  return (
    <View className="px-5 pt-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`최근 분석 ${count}건 모두 보기`}
        onPress={onSeeAll}
        className="flex-row items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3.5 active:opacity-70"
      >
        <View className="flex-row items-center gap-2">
          <Icon name="FileClock" size={18} color={color("primary")} />
          <Text className="text-[15px] font-semibold text-foreground">최근 분석 {count}건</Text>
        </View>
        <Icon name="ChevronRight" size={18} color={color("textMuted")} />
      </Pressable>
    </View>
  );
}
