import { View, Text, Image, Pressable } from "react-native";
import Sortable from "react-native-sortables";
import { Icon } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";
import type { DraftPage } from "../model/types";

export type MoveDir = "prev" | "next";

interface PageCardProps {
  page: DraftPage;
  index: number; // 0-based 현재 위치
  total: number;
  disabled?: boolean; // locked/dragging 시 삭제·이동 비활성
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: MoveDir) => void;
}

// 그리드 1셀 — 썸네일(드래그 핸들) + 페이지 번호 + 우상단 X.
// 이미지 본문이 드래그 핸들(길게 눌러 재정렬), 탭하면 전체화면 미리보기.
// X는 핸들 밖 형제(드래그와 영역 겹침 방지). 재정렬 접근성은 accessibilityActions(앞/뒤).
export function PageCard({ page, index, total, disabled, onOpen, onDelete, onMove }: PageCardProps) {
  const label = `${index + 1}페이지`;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  return (
    <View className="relative">
      {/* 드래그 핸들 = 이미지 본문. 탭=미리보기. */}
      <Sortable.Handle mode="draggable">
        <Pressable
          onPress={() => onOpen(page.id)}
          accessibilityRole="imagebutton"
          accessibilityLabel={`${label} 미리보기`}
          accessibilityHint="두 번 탭하면 확대, 길게 누르면 순서 변경"
          accessibilityActions={[
            ...(canPrev ? [{ name: "moveBack", label: "앞으로 이동" }] : []),
            ...(canNext ? [{ name: "moveForward", label: "뒤로 이동" }] : []),
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "moveBack") onMove(page.id, "prev");
            else if (e.nativeEvent.actionName === "moveForward") onMove(page.id, "next");
          }}
          className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-surface-alt"
        >
          <Image
            source={{ uri: page.thumbUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
          <View
            className="absolute left-2 top-2 rounded-md px-1.5 py-0.5"
            style={{ backgroundColor: "rgba(15,23,42,0.7)" }}
          >
            <Text className="text-[11px] font-semibold text-white">{index + 1}</Text>
          </View>
        </Pressable>
      </Sortable.Handle>

      {/* 삭제 — 핸들 밖, 실제 44pt 터치 영역. */}
      <Pressable
        onPress={() => !disabled && onDelete(page.id)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label} 삭제`}
        className="absolute right-1 top-1 h-11 w-11 items-center justify-center"
      >
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(15,23,42,0.7)" }}
        >
          <Icon name="X" size={16} color="#ffffff" />
        </View>
      </Pressable>
    </View>
  );
}
