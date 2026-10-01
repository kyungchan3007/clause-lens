import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Button, Icon } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";
import { useDraftStore } from "../model/draftStore";
import { useImagePicker } from "../model/useImagePicker";
import { PageItem } from "./PageItem";
import type { DraftPage } from "../model/types";

// 분석 제어(idle 전용) — 진행·터미널 표현은 전용 ProcessingScreen(app 레이어)이 소유.
// PageList는 담은 페이지 리뷰 + "분석하기"만. app이 idle일 때만 이 화면을 보여준다.
export interface AnalyzeControls {
  onAnalyze: () => void;
}

// quota: 하단 바에 끼울 잔량 표시(entitlement). app 레이어가 주입(capture는 entitlement를 모른다).
export function PageList({ analyze, quota }: { analyze?: AnalyzeControls; quota?: ReactNode }) {
  const pages = useDraftStore((s) => s.pages);
  const setPages = useDraftStore((s) => s.setPages);
  const locked = useDraftStore((s) => s.locked);
  const { captureToDraft } = useImagePicker();

  return (
    <View className="flex-1 px-4 pt-1">
      <DraggableFlatList
        data={pages}
        keyExtractor={(p) => p.id}
        onDragEnd={({ data }) => setPages(data)}
        renderItem={({ item, drag, isActive }: RenderItemParams<DraftPage>) => (
          <PageItem page={item} drag={drag} isActive={isActive} />
        )}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="mb-1 flex-row items-end justify-between">
            <Text className="text-base font-bold text-foreground">담은 페이지 {pages.length}장</Text>
            <Text className="text-xs text-foreground-muted">길게 눌러 순서 변경</Text>
          </View>
        }
        ListFooterComponent={
          <Pressable
            onPress={() => captureToDraft("library")}
            disabled={locked}
            className={`mt-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 ${locked ? "opacity-40" : ""}`}
            accessibilityLabel="페이지 추가"
          >
            <Icon name="Plus" size={17} color={color("primary")} />
            <Text className="text-sm font-medium text-primary">페이지 추가</Text>
          </Pressable>
        }
      />
      <View className="border-t border-border py-3">
        {quota ? (
          <View className="mb-2 flex-row items-center justify-between">
            {quota}
            <Text className="text-xs text-foreground-muted">완료 시 1회 차감</Text>
          </View>
        ) : null}
        <Button label="분석하기" variant="primary" onPress={() => analyze?.onAnalyze()} />
      </View>
    </View>
  );
}
