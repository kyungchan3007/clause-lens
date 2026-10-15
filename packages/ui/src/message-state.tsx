import * as React from "react";
import { Text, View } from "react-native";

import { IconBadge } from "./icon-badge";
import type { IconName } from "./icon";

// 표시 전용 상태 화면 본문 — 아이콘(선택)·제목(선택)·설명·액션 슬롯.
// 중앙 정렬·flex-1·safe area는 넣지 않는다(화면 배치는 호출측 소유, 0b-2). 너비는 w-full.
// EmptyState와 달리 icon·title이 모두 선택적이라, 아이콘 없는 에러/안내 fallback까지 커버한다.
// tone="danger": 설명을 danger 색으로, (아이콘을 주면) 배지도 danger tone.
export type MessageStateTone = "default" | "danger";

export interface MessageStateProps {
  icon?: IconName;
  title?: string;
  description?: string;
  tone?: MessageStateTone;
  actions?: React.ReactNode;
}

export function MessageState({
  icon,
  title,
  description,
  tone = "default",
  actions,
}: MessageStateProps) {
  const descColor = tone === "danger" ? "text-danger" : "text-foreground-muted";
  return (
    <View className="w-full items-center px-6">
      {icon ? (
        <IconBadge name={icon} tone={tone === "danger" ? "danger" : undefined} className="mb-5" />
      ) : null}
      {title ? (
        <Text className="text-center text-base font-medium text-foreground">{title}</Text>
      ) : null}
      {description ? (
        <Text className={`${title ? "mt-1.5 " : ""}text-center text-sm ${descColor}`}>
          {description}
        </Text>
      ) : null}
      {actions ? <View className="mt-6 w-full gap-3">{actions}</View> : null}
    </View>
  );
}
