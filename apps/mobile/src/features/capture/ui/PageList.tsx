import { View, Text, Pressable } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Button, Icon } from "@clause-lens/ui";
import { useDraftStore } from "../model/draftStore";
import { useImagePicker } from "../model/useImagePicker";
import { PageItem } from "./PageItem";
import type { DraftPage } from "../model/types";

export function PageList() {
  const pages = useDraftStore((s) => s.pages);
  const setPages = useDraftStore((s) => s.setPages);
  const { captureToDraft } = useImagePicker();

  return (
    <View className="flex-1 px-4 pt-3">
      <DraggableFlatList
        data={pages}
        keyExtractor={(p) => p.id}
        onDragEnd={({ data }) => setPages(data)}
        renderItem={({ item, drag, isActive }: RenderItemParams<DraftPage>) => (
          <PageItem page={item} drag={drag} isActive={isActive} />
        )}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <Pressable
            onPress={() => captureToDraft("library")}
            className="mt-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3"
            accessibilityLabel="페이지 추가"
          >
            <Icon name="Plus" size={17} color="#2563EB" />
            <Text className="text-sm font-medium text-primary">페이지 추가</Text>
          </Pressable>
        }
      />
      <View className="py-3">
        <Text className="mb-2 text-center text-xs text-foreground-muted">
          끌어서 순서 변경 · 탭해서 교체
        </Text>
        {/* 분석하기 동작(서버 분석 요청)은 TASK-003 */}
        <Button label="분석하기" variant="primary" onPress={() => {}} />
      </View>
    </View>
  );
}
