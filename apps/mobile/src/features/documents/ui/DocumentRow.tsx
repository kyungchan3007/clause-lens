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
  // 제목 폴백 — 서버가 빈 label을 줘도 접근성 라벨이 이름을 잃지 않게('문서').
  const title = item.label && item.label.trim() ? item.label : "문서";
  // 접근성 라벨: 제목·완료·위험·(일부 완료)·보관 기한까지 읽히게(스크린리더 회귀 방지). title로 항상 비어있지 않음.
  const a11yLabel = [title, completedAtLabel(item.completedAt), riskText, partialText, badge.label]
    .filter(Boolean)
    .join(", ");

  // 썸네일 자리 — 연한 가로 라인 플레이스홀더(문서 느낌). 실제 이미지 썸네일은 후속.
  // 장식 요소 — 의미는 행 전체 accessibilityLabel(a11yLabel)이 전달하므로 스크린리더에서 숨김.
  const leading = (
    <View
      testID="doc-thumb-placeholder"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="h-[60px] w-12 justify-center gap-[4px] rounded-xl border border-border bg-surface-alt px-2"
    >
      <View className="h-[3px] w-full rounded-full bg-border" />
      <View className="h-[3px] w-4/5 rounded-full bg-border" />
      <View className="h-[3px] w-3/5 rounded-full bg-border" />
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
      elevated
      title={title}
      supporting={supporting}
      leading={leading}
      trailing={trailing}
      onPress={onPress}
      accessibilityLabel={a11yLabel}
    />
  );
}
