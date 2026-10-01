import * as React from "react";
import { Pressable } from "react-native";
import { color } from "@clause-lens/tokens";

import { ICON_REGISTRY, type IconName } from "./icon";

export type IconButtonVariant = "plain" | "tinted";

// 아이콘 전용 버튼 — 터치 영역을 실제 레이아웃 크기로 보장(아이콘 크기와 독립, 0b-2).
// icon은 레지스트리 IconName만(오타·빈 버튼 차단). accessibilityLabel 필수.
export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number; // 아이콘 크기(px). 터치 영역 하한(48)은 별도.
  variant?: IconButtonVariant;
  disabled?: boolean;
  testID?: string;
}

const MIN_TOUCH = 48; // 양 플랫폼 최소 터치 영역

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 24,
  variant = "plain",
  disabled,
  testID,
}: IconButtonProps) {
  // icon은 IconName(레지스트리 키)이라 항상 유효한 컴포넌트 — 빈 버튼(null) 경로 없음.
  const Glyph = ICON_REGISTRY[icon];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH }}
      className={`items-center justify-center rounded-full ${
        variant === "tinted" ? "bg-primary-tint" : ""
      } ${disabled ? "opacity-50" : "active:opacity-60"}`}
    >
      <Glyph size={size} color={color(variant === "tinted" ? "primary" : "text")} strokeWidth={2} />
    </Pressable>
  );
}
