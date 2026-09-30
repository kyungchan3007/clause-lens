import * as React from "react";
import { Text, View } from "react-native";

import { Icon } from "./icon";

// 색·라벨(+선택 아이콘)만 받는 프레젠테이셔널 배지(알약형). 도메인 의미(위험도·종류 등)
// 매핑은 사용하는 쪽에서 넘긴다. 색은 인스턴스마다 달라 style로 주입.
export interface BadgeProps {
  label: string;
  // 텍스트·아이콘 색.
  color?: string;
  backgroundColor?: string;
  // lucide 아이콘 이름(선택).
  icon?: string;
  className?: string;
}

export function Badge({ label, color, backgroundColor, icon, className }: BadgeProps) {
  return (
    <View
      accessibilityRole="text"
      className={`flex-row items-center gap-1 self-start rounded-full px-2 py-0.5 ${
        className ?? ""
      }`}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      {icon ? <Icon name={icon} size={12} color={color} /> : null}
      <Text className="text-xs font-semibold" style={color ? { color } : undefined}>
        {label}
      </Text>
    </View>
  );
}
