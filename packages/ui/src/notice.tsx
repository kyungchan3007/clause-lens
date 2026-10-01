import * as React from "react";
import { Text, View } from "react-native";

import { Icon, type IconName } from "./icon";
import { toneAccent, type Tone } from "./tone";

// 고지·안내 배너(표시 전용) — 아이콘 + 텍스트. 문구·표시 조건은 호출측(홈/feature).
// tone은 info·neutral(muted 텍스트) + success(초록, 안심 안내). 자동 alert 처리 안 함.
export type NoticeTone = Extract<Tone, "info" | "neutral" | "success">;

export interface NoticeProps {
  children: React.ReactNode;
  tone?: NoticeTone;
  icon?: IconName;
  className?: string;
}

const CONTAINER: Record<NoticeTone, string> = {
  info: "bg-primary-tint",
  neutral: "bg-surface-alt",
  success: "bg-success-bg",
};

// success만 tone 텍스트색(초록 대비). info·neutral은 기존대로 muted 유지(회귀 방지).
const TEXT: Record<NoticeTone, string> = {
  info: "text-foreground-muted",
  neutral: "text-foreground-muted",
  success: "text-success-text",
};

export function Notice({ children, tone = "neutral", icon, className }: NoticeProps) {
  return (
    <View
      className={`flex-row items-start gap-2 rounded-2xl p-3 ${CONTAINER[tone]} ${className ?? ""}`}
    >
      {icon ? <Icon name={icon} size={16} color={toneAccent(tone)} /> : null}
      <Text className={`flex-1 text-xs leading-5 ${TEXT[tone]}`}>{children}</Text>
    </View>
  );
}
