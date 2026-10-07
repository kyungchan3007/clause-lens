import { useEffect } from "react";
import { FlatList, Text, View } from "react-native";
import { EmptyState, LoadingIndicator, RetryInline, ScreenHeader } from "@clause-lens/ui";

import { useDocumentsStore } from "../model/documentsStore";
import { DocumentRow } from "./DocumentRow";
import { SubscriptionPromoCard } from "./SubscriptionPromoCard";


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
      <ScreenHeader
        title="최근 분석"
        subtitle="분석 결과는 7일 동안 보관돼요."
        onBack={onBack}
      />

      {status === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <LoadingIndicator label="불러오는 중" />
        </View>
      ) : status === "error" && items.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-sm text-danger">목록을 불러오지 못했어요</Text>
          <RetryInline
            onRetry={() => void refresh()}
            label="다시 시도"
            className="rounded-xl bg-primary px-4 py-2 active:opacity-80"
            textClassName="text-sm font-semibold text-white"
          />
        </View>
      ) : (
        <View className="flex-1">
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
          ListEmptyComponent={
            // EmptyState는 중앙배치를 스스로 소유하지 않음 → wrapper로 위치 보존.
            <View className="items-center py-16">
              <EmptyState
                icon="FileClock"
                title="아직 분석한 계약서가 없어요"
                subtitle="계약서를 촬영하면 분석 결과가 여기에 쌓여요."
              />
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4">
                <LoadingIndicator label="더 불러오는 중" />
              </View>
            ) : !nextCursor && items.length > 0 ? (
              <Text className="py-4 text-center text-xs text-foreground-muted">
                마지막까지 모두 봤어요
              </Text>
            ) : null
          }
        />
        {items.length > 0 ? (
          <View className="px-4 pb-3 pt-1">
            <SubscriptionPromoCard />
          </View>
        ) : null}
        </View>
      )}
    </View>
  );
}
