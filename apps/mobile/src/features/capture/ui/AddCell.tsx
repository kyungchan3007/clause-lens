import { View, Text, Pressable } from "react-native";
import Sortable from "react-native-sortables";
import { Icon } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

// 그리드 마지막 셀 — 점선 "+ 추가". fixed-order 핸들로 드래그·순서 이동 모두 차단(항상 끝).
export function AddCell({ disabled, onPress }: { disabled?: boolean; onPress: () => void }) {
  return (
    <Sortable.Handle mode="fixed-order">
      <Pressable
        onPress={() => !disabled && onPress()}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="페이지 추가"
        className={`aspect-[3/4] w-full items-center justify-center rounded-2xl border border-dashed border-border ${
          disabled ? "opacity-40" : ""
        }`}
      >
        <Icon name="Plus" size={24} color={color("primary")} />
        <Text className="mt-1.5 text-sm font-semibold text-primary">추가</Text>
      </Pressable>
    </Sortable.Handle>
  );
}
