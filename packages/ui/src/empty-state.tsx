import * as React from "react";
import { Text, View } from "react-native";

import { IconBadge } from "./icon-badge";
import type { IconName } from "./icon";

// 표시 전용 빈 상태 — 아이콘 배지 + 제목 + 부제 + 액션 슬롯만.
// flex-1/ScrollView/safe area·중앙배치는 넣지 않는다(화면 배치는 호출측 소유, 0b-2).
// 루트는 비상호작용. 너비는 w-full로 부모 폭을 채운다(items-center 부모 아래 축소 방지).
export interface EmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function EmptyState({ icon, title, subtitle, actions }: EmptyStateProps) {
  return (
    <View className="w-full items-center px-6">
      <IconBadge name={icon} size={36} className="mb-5" />
      <Text className="text-lg font-medium text-foreground">{title}</Text>
      {subtitle ? (
        <Text className="mb-8 mt-1.5 text-center text-sm text-foreground-muted">{subtitle}</Text>
      ) : null}
      {actions ? <View className="w-full gap-3">{actions}</View> : null}
    </View>
  );
}
