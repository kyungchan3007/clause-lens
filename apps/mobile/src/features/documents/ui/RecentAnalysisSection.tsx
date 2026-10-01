import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Icon, SectionHeader } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

import { useDocumentsStore } from "../model/documentsStore";
import { DocumentRow } from "./DocumentRow";

const HOME_PREVIEW = 3;

// 홈 '최근 분석' 섹션. 상위 N개 미리보기 + "모두 보기". 서버 값만 표시.
export function RecentAnalysisSection({
  onOpen,
  onSeeAll,
}: {
  onOpen: (documentId: string) => void;
  onSeeAll: () => void;
}) {
  const status = useDocumentsStore((s) => s.status);
  const items = useDocumentsStore((s) => s.items);
  const refresh = useDocumentsStore((s) => s.refresh);

  const preview = items.slice(0, HOME_PREVIEW);
  const hasMore = items.length > HOME_PREVIEW;

  return (
    <View className="gap-2.5 px-5 pt-2">
      <SectionHeader
        label="최근 분석"
        variant="title"
        action={
          status === "ready" && items.length > 0
            ? { label: "모두 보기", onPress: onSeeAll }
            : undefined
        }
      />

      {status === "loading" ? (
        <View className="items-center py-6">
          <ActivityIndicator accessibilityLabel="불러오는 중" />
        </View>
      ) : status === "error" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void refresh()}
          className="items-center rounded-2xl border border-border bg-surface py-6 active:opacity-70"
        >
          <Text className="text-sm text-danger">불러오지 못했어요 · 다시 시도</Text>
        </Pressable>
      ) : items.length === 0 ? (
        <View className="items-center gap-1 rounded-2xl border border-dashed border-border bg-surface py-7">
          <Icon name="FileClock" size={22} color={color("textMuted")} />
          <Text className="text-sm text-foreground-muted">아직 분석한 계약서가 없어요</Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {preview.map((item) => (
            <DocumentRow key={item.documentId} item={item} onPress={() => onOpen(item.documentId)} />
          ))}
          {hasMore ? (
            <Pressable
              accessibilityRole="button"
              onPress={onSeeAll}
              className="items-center py-1 active:opacity-60"
            >
              <Text className="text-sm font-medium text-foreground-muted">
                최근 분석 {items.length}건 모두 보기
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}
