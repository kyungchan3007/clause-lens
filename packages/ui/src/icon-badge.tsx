import * as React from "react";
import { View } from "react-native";
import { semantic } from "@clause-lens/tokens";

import { Icon } from "./icon";

// 원형 tint 배경 + 아이콘. 빈 상태·프로필 아바타 등에서 공통으로 쓰는 배지.
export interface IconBadgeProps {
  name: string;
  // 아이콘 크기(px).
  size?: number;
  color?: string;
  // 컨테이너에 덧붙일 클래스(여백 등). 기본 크기(h-20 w-20)는 유지되고 여기에 추가된다.
  className?: string;
}

export function IconBadge({ name, size = 36, color, className }: IconBadgeProps) {
  return (
    <View
      className={`h-20 w-20 items-center justify-center rounded-full bg-primary-tint ${
        className ?? ""
      }`}
    >
      <Icon name={name} size={size} color={color ?? semantic.light.primary} />
    </View>
  );
}
