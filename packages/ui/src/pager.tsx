import * as React from "react";
import { Text, View } from "react-native";

import { IconButton } from "./icon-button";

// 페이지 네비게이션 알약 — 상태 비소유(controlled). `current`는 1-based.
// total<=0 → null · total===1 → 정적 "1 / 1" · else ‹ · n/total · ›(양끝 실제 disabled + a11y).
// 라우팅·결과 데이터는 넣지 않는다(소비자가 pageIndex+1·total을 넘기고 콜백을 연결).
export interface PagerProps {
  current: number; // 1-based 현재 페이지
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

const TABULAR = { fontVariant: ["tabular-nums" as const] };

export function Pager({ current, total, onPrev, onNext }: PagerProps) {
  if (total <= 0) return null;

  const counter = (
    <Text
      accessibilityLabel={`전체 ${total}페이지 중 ${current}페이지`}
      style={TABULAR}
      className="min-w-[36px] text-center text-xs font-bold text-foreground"
    >
      {current} / {total}
    </Text>
  );

  if (total === 1) {
    return (
      <View className="flex-row items-center self-start rounded-full bg-surface-subtle px-3 py-1.5">
        {counter}
      </View>
    );
  }

  return (
    <View className="flex-row items-center self-start rounded-full bg-surface-subtle px-1">
      <IconButton
        icon="ChevronLeft"
        accessibilityLabel="이전 페이지"
        onPress={onPrev}
        disabled={current <= 1}
        size={18}
      />
      {counter}
      <IconButton
        icon="ChevronRight"
        accessibilityLabel="다음 페이지"
        onPress={onNext}
        disabled={current >= total}
        size={18}
      />
    </View>
  );
}
