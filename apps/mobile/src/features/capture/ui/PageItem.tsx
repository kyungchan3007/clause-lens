import { View, Text, Image, Pressable } from "react-native";
import { ScaleDecorator } from "react-native-draggable-flatlist";
import { Icon } from "@clause-lens/ui";
import { useDraftStore } from "../model/draftStore";
import { useImagePicker } from "../model/useImagePicker";
import type { DraftPage } from "../model/types";

interface PageItemProps {
  page: DraftPage;
  drag: () => void;
  isActive: boolean;
}

export function PageItem({ page, drag, isActive }: PageItemProps) {
  const removePage = useDraftStore((s) => s.removePage);
  const { replaceDraft } = useImagePicker();

  return (
    <ScaleDecorator>
      <View
        className={`mb-2 flex-row items-center gap-3 rounded-xl border p-2 ${
          isActive ? "border-primary bg-primary-tint" : "border-border bg-surface"
        }`}
      >
        <Pressable onLongPress={drag} delayLongPress={120} hitSlop={8} accessibilityLabel="순서 변경">
          <Icon name="GripVertical" size={18} color={isActive ? "#2563EB" : "#B6BCC7"} />
        </Pressable>
        <Image
          source={{ uri: page.localUri }}
          style={{ width: 44, height: 56 }}
          className="rounded-md bg-surface-alt"
          resizeMode="cover"
        />
        <Text className="flex-1 text-sm text-foreground">{page.order + 1}페이지</Text>
        <Pressable hitSlop={8} onPress={() => replaceDraft(page.id, "library")} accessibilityLabel="페이지 교체">
          <Icon name="RefreshCw" size={18} color="#64748B" />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => removePage(page.id)} accessibilityLabel="페이지 삭제">
          <Icon name="Trash2" size={18} color="#64748B" />
        </Pressable>
      </View>
    </ScaleDecorator>
  );
}
