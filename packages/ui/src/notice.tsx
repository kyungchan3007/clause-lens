import * as React from "react";
import { Text, View } from "react-native";

import { Icon, type IconName } from "./icon";
import { toneAccent, type Tone } from "./tone";

// 고지·안내 배너(표시 전용) — 아이콘 + 텍스트. 문구·표시 조건은 호출측(홈/feature).
// tone은 info(기본)·neutral. 일반 안내를 자동 alert 처리하지 않는다.
export interface NoticeProps {
  children: React.ReactNode;
  tone?: Extract<Tone, "info" | "neutral">;
  icon?: IconName;
  className?: string;
}

const CONTAINER: Record<"info" | "neutral", string> = {
  info: "bg-primary-tint",
  neutral: "bg-surface-alt",
};

export function Notice({ children, tone = "neutral", icon, className }: NoticeProps) {
  return (
    <View
      className={`flex-row items-start gap-2 rounded-2xl p-3 ${CONTAINER[tone]} ${className ?? ""}`}
    >
      {icon ? <Icon name={icon} size={16} color={toneAccent(tone)} /> : null}
      <Text className="flex-1 text-xs leading-5 text-foreground-muted">{children}</Text>
    </View>
  );
}
