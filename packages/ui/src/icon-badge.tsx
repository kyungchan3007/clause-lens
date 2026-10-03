import * as React from "react";
import { View } from "react-native";
import { color as tokenColor } from "@clause-lens/tokens";

import { Icon } from "./icon";
import { toneAccent, toneClasses, type Tone } from "./tone";

// 원형 배경 + 아이콘. 빈 상태·프로필 아바타 등에서 공통으로 쓰는 배지.
// 기본은 primary tint. tone을 주면 그 tone의 배경(50대)+강조색(600) 조합(예: success=초록 안심).
export interface IconBadgeProps {
  name: string;
  // 아이콘 크기(px).
  size?: number;
  color?: string;
  tone?: Tone;
  // 컨테이너에 덧붙일 클래스(여백 등). 기본 크기(h-20 w-20)는 유지되고 여기에 추가된다.
  className?: string;
}

export function IconBadge({ name, size = 36, color, tone, className }: IconBadgeProps) {
  const bg = tone ? toneClasses(tone).container : "bg-primary-tint";
  const glyphColor = color ?? (tone ? toneAccent(tone) : tokenColor("primary"));
  return (
    <View
      className={`h-20 w-20 items-center justify-center rounded-full ${bg} ${className ?? ""}`}
    >
      <Icon name={name} size={size} color={glyphColor} />
    </View>
  );
}
