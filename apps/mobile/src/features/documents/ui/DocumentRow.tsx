import { Pressable, Text, View } from "react-native";
import type { DocumentListItem } from "@clause-lens/contracts";
import { Icon } from "@clause-lens/ui";
import { semantic } from "@clause-lens/tokens";

import { completedAtLabel, retentionBadge, riskSummary } from "../lib/retentionBadge";

const c = semantic.light;

const RISK_DOT: Record<"high" | "medium" | "low", string> = {
  high: c.danger,
  medium: c.warning,
  low: c.success,
};

// 재열람 문서 1행(홈 최근·목록 공용). 서버 값만 표시(라벨·완료일·위험·보관 배지).
export function DocumentRow({
  item,
  onPress,
}: {
  item: DocumentListItem;
  onPress: () => void;
}) {
  const badge = retentionBadge(item.retainUntil);
  const { total, top } = riskSummary(item.risk);
  const dotColor = top ? RISK_DOT[top] : c.textMuted;
  const riskText = total > 0 ? `위험 ${total}건` : "위험 없음";
  const partial = item.status === "partial";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}, ${riskText}, ${badge.label}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:opacity-70"
    >
      <View className="h-[60px] w-12 items-center justify-center rounded-xl border border-border bg-surface-alt">
        <Icon name="FileText" size={22} color={c.textMuted} />
      </View>

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-sm font-semibold text-foreground">
          {item.label}
        </Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Text className="text-xs text-foreground-muted">{completedAtLabel(item.completedAt)}</Text>
          <Text className="text-xs text-foreground-muted">·</Text>
          <View className="flex-row items-center gap-1">
            <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: dotColor }} />
            <Text className="text-xs text-foreground-muted">{riskText}</Text>
          </View>
        </View>
        {partial ? (
          <Text className="mt-0.5 text-xs text-foreground-muted">
            일부 분석 완료 · {item.analyzedPageCount}/{item.totalPageCount}장
          </Text>
        ) : null}
      </View>

      <View className="items-end gap-1.5">
        <View
          className="rounded-full px-2 py-0.5"
          style={{ backgroundColor: badge.urgent ? c.dangerBg : c.warningBg }}
        >
          <Text
            className="text-[11px] font-semibold"
            style={{ color: badge.urgent ? c.danger : c.warning }}
          >
            {badge.label}
          </Text>
        </View>
        <Icon name="ChevronRight" size={18} color={c.border} />
      </View>
    </Pressable>
  );
}
