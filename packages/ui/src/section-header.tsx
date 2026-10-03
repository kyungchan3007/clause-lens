import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { color } from "@clause-lens/tokens";

import { Icon } from "./icon";

export type SectionHeaderVariant = "label" | "title";

// 섹션 헤더. label(기본, muted xs + 자체 여백)과 title(굵은 base, 외부 여백은 호출측 소유)로 구분.
// - count: 제목 끝에 강조 숫자(accent). 중첩 <Text>라 제목 전체가 하나의 헤더로 읽힌다.
// - action: 제목과 형제 Pressable(button) — "모두 보기" 등.
// - hint: 비상호작용 보조 안내(우측 muted). action과 달리 버튼이 아니다(가짜 버튼 방지).
export interface SectionHeaderProps {
  label: string;
  variant?: SectionHeaderVariant;
  count?: number;
  action?: { label: string; onPress: () => void };
  hint?: string;
  className?: string;
}

const LABEL_CLS = "text-xs font-medium text-foreground-muted";
const TITLE_CLS = "text-base font-bold text-foreground";
// label variant는 기존 섹션 여백을 스스로 소유(기존 호출부 호환). title은 소유하지 않음(이중 여백 방지).
const LABEL_PAD = "px-4 pb-2 pt-6";

export function SectionHeader({
  label,
  variant = "label",
  count,
  action,
  hint,
  className,
}: SectionHeaderProps) {
  const textCls = variant === "title" ? TITLE_CLS : LABEL_CLS;
  const ownPad = variant === "label" ? LABEL_PAD : "";

  // count 없으면 children은 순수 문자열(label) — 기존 소비자/테스트 호환(trailing null 배열 방지).
  const renderTitle = (cls: string) => (
    <Text accessibilityRole="header" className={cls}>
      {count === undefined ? (
        label
      ) : (
        <>
          {label}
          <Text className="text-primary"> {count}</Text>
        </>
      )}
    </Text>
  );

  if (action) {
    return (
      <View className={`flex-row items-center justify-between ${ownPad} ${className ?? ""}`}>
        {renderTitle(textCls)}
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

  if (hint) {
    return (
      <View className={`flex-row items-center justify-between ${ownPad} ${className ?? ""}`}>
        {renderTitle(textCls)}
        <Text className="text-xs text-foreground-muted">{hint}</Text>
      </View>
    );
  }

  return renderTitle(`${ownPad} ${textCls} ${className ?? ""}`);
}
