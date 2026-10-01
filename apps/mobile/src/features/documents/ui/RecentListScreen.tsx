import { useEffect } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { Icon } from "@clause-lens/ui";
import { semantic } from "@clause-lens/tokens";

import { useDocumentsStore } from "../model/documentsStore";
import { DocumentRow } from "./DocumentRow";

const c = semantic.light;

// 최근 분석 전체 목록(무한 스크롤·당겨서 새로고침). 서버 값만 표시.
export function RecentListScreen({
  onOpen,
  onBack,
}: {
  onOpen: (documentId: string) => void;
  onBack: () => void;
}) {
  const status = useDocumentsStore((s) => s.status);
  const items = useDocumentsStore((s) => s.items);
  const refreshing = useDocumentsStore((s) => s.refreshing);
  const loadingMore = useDocumentsStore((s) => s.loadingMore);
  const nextCursor = useDocumentsStore((s) => s.nextCursor);
  const refresh = useDocumentsStore((s) => s.refresh);
  const loadMore = useDocumentsStore((s) => s.loadMore);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={onBack}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-xl active:opacity-60"
        >
          <Icon name="ChevronLeft" size={22} color={c.text} />
        </Pressable>
        <Text className="text-lg font-bold text-foreground">최근 분석</Text>
      </View>

      {status === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="불러오는 중" />
        </View>
      ) : status === "error" && items.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-sm text-danger">목록을 불러오지 못했어요</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refresh()}
            className="rounded-xl bg-primary px-4 py-2 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-white">다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.documentId}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <DocumentRow item={item} onPress={() => onOpen(item.documentId)} />
          )}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMore()}
          ListHeaderComponent={
            <Text className="pb-1 text-xs text-foreground-muted">
              분석 결과는 7일 동안 보관돼요.
            </Text>
          }
          ListEmptyComponent={
            <View className="items-center gap-1 py-16">
              <Icon name="FileClock" size={26} color={c.textMuted} />
              <Text className="text-sm text-foreground-muted">아직 분석한 계약서가 없어요</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4">
                <ActivityIndicator accessibilityLabel="더 불러오는 중" />
              </View>
            ) : !nextCursor && items.length > 0 ? (
              <Text className="py-4 text-center text-xs text-foreground-muted">
                마지막까지 모두 봤어요
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}
