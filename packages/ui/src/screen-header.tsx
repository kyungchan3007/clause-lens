import * as React from "react";
import { Text, View } from "react-native";

import { IconButton } from "./icon-button";

// 화면 공용 헤더 — 뒤로 + 제목 + (선택) 부제 + (선택) 우측 슬롯.
// 타이포는 ResultHeader와 동일(17px/800)로 앱 내 헤더 일관. 뒤로는 공용 IconButton(48pt·a11y "뒤로").
// 결과 전용 ResultHeader(Pager 조합)·home BrandHeader(브랜드)는 구조가 달라 흡수하지 않는다.
export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  return (
    <View className="border-b border-border bg-surface px-2 py-1.5">
      <View className="flex-row items-center gap-2">
        {onBack ? (
          <IconButton icon="ChevronLeft" accessibilityLabel="뒤로" onPress={onBack} />
        ) : (
          <View className="w-2" />
        )}
        <Text
          accessibilityRole="header"
          className="flex-1 text-[17px] font-extrabold tracking-tight text-foreground"
        >
          {title}
        </Text>
        {right != null ? <View className="flex-shrink-0">{right}</View> : null}
      </View>
      {subtitle ? (
        // 타이틀 아래 들여쓰기(뒤로 버튼 폭만큼) — 시안: 헤더 안, 타이틀 아래.
        <Text className="pl-12 pr-2 pt-0.5 text-xs text-foreground-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}
