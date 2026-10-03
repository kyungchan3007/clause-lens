import * as React from "react";
import { Text, View } from "react-native";
import { IconButton, Pager } from "@clause-lens/ui";

// 결과 화면 전용 헤더 — 닫기 + 제목 + 페이지 네비 알약(공용 Pager 조합).
// BrandHeader(home feature)는 FSD 경계상 재사용하지 않고, 공용 IconButton·Pager로 조합한다.
interface ResultHeaderProps {
  pageIndex: number; // 0-based
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose?: () => void;
}

export function ResultHeader({ pageIndex, total, onPrev, onNext, onClose }: ResultHeaderProps) {
  return (
    <View className="flex-row items-center gap-2 border-b border-border px-2 py-1.5">
      {onClose ? (
        <IconButton icon="ChevronLeft" accessibilityLabel="분석 결과 닫기" onPress={onClose} />
      ) : (
        <View className="w-2" />
      )}
      <Text className="flex-1 text-[17px] font-extrabold tracking-tight text-foreground">
        분석 결과
      </Text>
      <Pager current={pageIndex + 1} total={total} onPrev={onPrev} onNext={onNext} />
    </View>
  );
}
