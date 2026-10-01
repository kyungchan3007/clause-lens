import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { color } from "@clause-lens/tokens";

import { Icon } from "./icon";

export type SectionHeaderVariant = "label" | "title";

// 섹션 헤더. label(기본, muted xs + 자체 여백)과 title(굵은 base, 외부 여백은 호출측 소유)로 구분.
// action은 제목과 형제 Pressable(button) — "모두 보기" 등. 중첩 Pressable 아님.
export interface SectionHeaderProps {
  label: string;
  variant?: SectionHeaderVariant;
  action?: { label: string; onPress: () => void };
  className?: string;
}

const LABEL_CLS = "text-xs font-medium text-foreground-muted";
const TITLE_CLS = "text-base font-bold text-foreground";
// label variant는 기존 섹션 여백을 스스로 소유(기존 호출부 호환). title은 소유하지 않음(이중 여백 방지).
const LABEL_PAD = "px-4 pb-2 pt-6";

export function SectionHeader({ label, variant = "label", action, className }: SectionHeaderProps) {
  const textCls = variant === "title" ? TITLE_CLS : LABEL_CLS;
  const ownPad = variant === "label" ? LABEL_PAD : "";

  if (!action) {
    return (
      <Text accessibilityRole="header" className={`${ownPad} ${textCls} ${className ?? ""}`}>
        {label}
      </Text>
    );
  }
  return (
    <View className={`flex-row items-center justify-between ${ownPad} ${className ?? ""}`}>
      <Text accessibilityRole="header" className={textCls}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        onPress={action.onPress}
        hitSlop={8}
        className="flex-row items-center active:opacity-60"
      >
        <Text className="text-sm font-medium text-foreground-muted">{action.label}</Text>
        <Icon name="ChevronRight" size={15} color={color("textMuted")} />
      </Pressable>
    </View>
  );
}
