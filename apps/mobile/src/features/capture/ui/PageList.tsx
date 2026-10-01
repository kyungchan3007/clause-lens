import { useState, type ReactNode } from "react";
import { View, Text } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import Sortable, { type SortableGridRenderItemInfo } from "react-native-sortables";
import { Button } from "@clause-lens/ui";
import { useDraftStore } from "../model/draftStore";
import { useImagePicker } from "../model/useImagePicker";
import { PageCard, type MoveDir } from "./PageCard";
import { AddCell } from "./AddCell";
import { PagePreviewModal } from "./PagePreviewModal";
import type { DraftPage } from "../model/types";

// 분석 제어(idle 전용) — 진행·터미널 표현은 전용 ProcessingScreen(app 레이어)이 소유.
export interface AnalyzeControls {
  onAnalyze: () => void;
}

// 그리드 표시용 셀 — 페이지 또는 "+추가"(fixed-order). DraftPage[]엔 넣지 않는다(저장 배열 오염 방지).
type GridCell = { kind: "page"; page: DraftPage } | { kind: "add" };
const ADD_KEY = "__add__";

// quota: 하단 바에 끼울 잔량 표시(entitlement). app 레이어가 주입.
export function PageList({ analyze, quota }: { analyze?: AnalyzeControls; quota?: ReactNode }) {
  const pages = useDraftStore((s) => s.pages);
  const locked = useDraftStore((s) => s.locked);
  const reorderByIds = useDraftStore((s) => s.reorderByIds);
  const removePage = useDraftStore((s) => s.removePage);
  const setDragging = useDraftStore((s) => s.setDragging);
  const { captureToDraft, replaceDraft } = useImagePicker();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewIndex = pages.findIndex((p) => p.id === previewId);
  const previewPage = previewIndex >= 0 ? pages[previewIndex] : null;

  const editDisabled = locked;
  const data: GridCell[] = [...pages.map((p) => ({ kind: "page" as const, page: p })), { kind: "add" as const }];

  // 접근성 "앞/뒤" 이동 — id 순서만 바꿔 reorderByIds(집합 검증은 store가).
  const move = (id: string, dir: MoveDir): void => {
    const ids = pages.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = dir === "prev" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderByIds(ids);
  };

  const renderItem = ({ item }: SortableGridRenderItemInfo<GridCell>) => {
    if (item.kind === "add") {
      return <AddCell disabled={editDisabled} onPress={() => captureToDraft("library")} />;
    }
    const index = pages.findIndex((p) => p.id === item.page.id);
    return (
      <PageCard
        page={item.page}
        index={index}
        total={pages.length}
        disabled={editDisabled}
        onOpen={setPreviewId}
        onDelete={removePage}
        onMove={move}
      />
    );
  };

  return (
    <View className="flex-1 px-4 pt-1">
      <View className="mb-2 flex-row items-end justify-between">
        <Text className="text-base font-bold text-foreground">담은 페이지 {pages.length}장</Text>
        <Text className="text-xs text-foreground-muted">길게 눌러 순서 변경</Text>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Sortable.Grid
          columns={2}
          data={data}
          keyExtractor={(c) => (c.kind === "add" ? ADD_KEY : c.page.id)}
          renderItem={renderItem}
          rowGap={12}
          columnGap={12}
          customHandle
          sortEnabled={pages.length > 1 && !locked}
          dragActivationDelay={300}
          scrollableRef={scrollRef}
          onDragStart={() => setDragging(true)}
          onDragEnd={({ data: next }) => {
            setDragging(false);
            const ids = next
              .filter((c): c is { kind: "page"; page: DraftPage } => c.kind === "page")
              .map((c) => c.page.id);
            reorderByIds(ids);
          }}
        />
      </Animated.ScrollView>

      <View className="border-t border-border py-3">
        {quota ? (
          <View className="mb-2 flex-row items-center justify-between">
            {quota}
            <Text className="text-xs text-foreground-muted">완료 시 1회 차감</Text>
          </View>
        ) : null}
        <Button
          label="분석하기"
          variant="primary"
          disabled={pages.length === 0 || locked}
          onPress={() => analyze?.onAnalyze()}
        />
      </View>

      <PagePreviewModal
        page={previewPage}
        index={previewIndex}
        disabled={editDisabled}
        onClose={() => setPreviewId(null)}
        onReplace={(id) => {
          setPreviewId(null);
          void replaceDraft(id, "library");
        }}
        onDelete={(id) => {
          setPreviewId(null);
          removePage(id);
        }}
      />
    </View>
  );
}
