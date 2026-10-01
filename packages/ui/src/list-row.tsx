import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { cardShadowStyle } from "./shadow";

export type ListRowVariant = "card" | "flat";

export interface ListRowProps {
  title: string;
  // 보조 영역: string이면 기본 muted Text, ReactNode이면 호출측이 타이포·줄바꿈 소유.
  supporting?: React.ReactNode;
  leading?: React.ReactNode;
  // 표시 슬롯(독립 액션 아님) — 행 전체 press 영역에 포함된다.
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ListRowVariant;
  // card variant에 옅은 그림자(홈·목록 raised). 소비자가 명시 — ListRow 기본은 평면.
  elevated?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

// 리스트 1행: 배치·행 전체 press·접근성만 공통화. 표면(card/flat)은 variant로.
// trailing(배지·chevron 등)도 행 터치 영역 안 — 눌러도 onPress가 실행된다(독립 액션 아님).
// 표면·제목 타이포를 variant로 함께 정의(카드=조밀, 평면 메뉴=기본). Codex: 제목 크기도 variant로.
const VARIANT: Record<ListRowVariant, { container: string; title: string }> = {
  card: { container: "rounded-2xl border border-border bg-surface p-3", title: "text-sm font-semibold" },
  flat: { container: "min-h-[56px] border-b border-border bg-surface px-4", title: "text-base" },
};

export function ListRow({
  title,
  supporting,
  leading,
  trailing,
  onPress,
  disabled,
  variant = "card",
  elevated,
  accessibilityLabel,
  accessibilityHint,
}: ListRowProps) {
  const shadowStyle = elevated && variant === "card" ? cardShadowStyle : undefined;
  const body = (
    <>
      {leading != null ? <View className="flex-shrink-0">{leading}</View> : null}
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className={`text-foreground ${VARIANT[variant].title}`}>
          {title}
        </Text>
        {typeof supporting === "string" ? (
          <Text className="mt-0.5 text-xs text-foreground-muted">{supporting}</Text>
        ) : (
          supporting
        )}
      </View>
      {trailing != null ? <View className="flex-shrink-0">{trailing}</View> : null}
    </>
  );

  const base = `flex-row items-center gap-3 ${VARIANT[variant].container}`;

  if (!onPress) {
    return (
      <View className={base} style={shadowStyle}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={shadowStyle}
      className={`${base} ${disabled ? "opacity-50" : "active:opacity-70"}`}
    >
      {body}
    </Pressable>
  );
}
