import * as React from "react";
import { Text, View } from "react-native";

import { Icon } from "./icon";
import { toneClasses, toneForeground, type Tone } from "./tone";

// 비상호작용 라벨(알약형). 색은 tone으로만 — 텍스트·배경·아이콘 조합을 tone이 정한다(접근성 대비).
// 도메인 의미(위험도 등)→tone 매핑은 소비자(result 등)가 하고, Badge는 tone 문자열만 받는다.
export interface BadgeProps {
  label: string;
  tone?: Tone;
  // lucide 아이콘 이름(선택). 색은 tone 전경색을 따른다.
  icon?: string;
  className?: string;
}

export function Badge({ label, tone = "neutral", icon, className }: BadgeProps) {
  const t = toneClasses(tone);
  return (
    <View
      accessibilityRole="text"
      className={`flex-row items-center gap-1 self-start rounded-full px-2 py-0.5 ${t.container} ${
        className ?? ""
      }`}
    >
      {icon ? <Icon name={icon} size={12} color={toneForeground(tone)} /> : null}
      <Text className={`text-xs font-semibold ${t.text}`}>{label}</Text>
    </View>
  );
}
