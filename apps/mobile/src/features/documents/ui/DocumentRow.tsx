import { Text, View } from "react-native";
import type { DocumentListItem } from "@clause-lens/contracts";
import { Badge, Icon, ListRow, StatusDot, type Tone } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

import { completedAtLabel, retentionBadge, riskSummary, type RiskSeverity } from "../lib/retentionBadge";

// 위험 최고 severity → tone(StatusDot·텍스트 의미). 없으면 중립.
function severityTone(top: RiskSeverity): Tone {
  return top === "high" ? "danger" : top === "medium" ? "warning" : top === "low" ? "success" : "neutral";
}

// 재열람 문서 1행(홈 최근·목록 공용). 공용 ListRow 조립 — 배지·chevron 포함 행 전체 터치.
export function DocumentRow({
  item,
  onPress,
}: {
  item: DocumentListItem;
  onPress: () => void;
}) {
  const badge = retentionBadge(item.retainUntil);
  const { total, top } = riskSummary(item.risk);
  const tone = severityTone(top);
  const riskText = total > 0 ? `위험 ${total}건` : "위험 없음";
  const partial = item.status === "partial";
  const partialText = partial
    ? `일부 분석 완료 · ${item.analyzedPageCount}/${item.totalPageCount}장`
    : null;
  // 접근성 라벨: 라벨·완료·위험·(일부 완료)·보관 기한까지 읽히게(스크린리더 회귀 방지).
  const a11yLabel = [item.label, completedAtLabel(item.completedAt), riskText, partialText, badge.label]
    .filter(Boolean)
    .join(", ");

  const leading = (
    <View className="h-[60px] w-12 items-center justify-center rounded-xl border border-border bg-surface-alt">
      <Icon name="FileText" size={22} color={color("textMuted")} />
    </View>
  );

  const supporting = (
    <View>
      <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
        <Text className="text-xs text-foreground-muted">{completedAtLabel(item.completedAt)}</Text>
        <Text className="text-xs text-foreground-muted">·</Text>
        <View className="flex-row items-center gap-1">
          <StatusDot tone={tone} />
          <Text className="text-xs text-foreground-muted">{riskText}</Text>
        </View>
      </View>
      {partialText ? (
        <Text className="mt-0.5 text-xs text-foreground-muted">{partialText}</Text>
      ) : null}
    </View>
  );

  const trailing = (
    <View className="items-end gap-1.5">
      <Badge label={badge.label} tone={badge.urgent ? "danger" : "warning"} />
      <Icon name="ChevronRight" size={18} color={color("border")} />
    </View>
  );

  return (
    <ListRow
      variant="card"
      title={item.label}
      supporting={supporting}
      leading={leading}
      trailing={trailing}
      onPress={onPress}
      accessibilityLabel={a11yLabel}
    />
  );
}
