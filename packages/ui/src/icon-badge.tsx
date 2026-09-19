import * as React from "react";
import { View } from "react-native";
import { semantic } from "@clause-lens/tokens";

import { Icon } from "./icon";

// 원형 tint 배경 + 아이콘. 빈 상태·프로필 아바타 등에서 공통으로 쓰는 배지.
export interface IconBadgeProps {
  name: string;
  // 아이콘 크기(px). 컨테이너 크기는 className으로 조정.
  size?: number;
  color?: string;
  // 컨테이너 오버라이드(기본: h-20 w-20). 여백 등 함께 넘길 때 크기도 포함해야 함.
  className?: string;
}

export function IconBadge({ name, size = 36, color, className }: IconBadgeProps) {
  return (
    <View
      className={`items-center justify-center rounded-full bg-primary-tint ${
        className ?? "h-20 w-20"
      }`}
    >
      <Icon name={name} size={size} color={color ?? semantic.light.primary} />
    </View>
  );
}
