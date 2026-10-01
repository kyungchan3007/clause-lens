import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { color } from "@clause-lens/tokens";

import { Icon, type IconName } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

// 스타일 표면은 semantic props만 — className·style·무제한 spread 없음(우회 차단, 0b-2).
// 허용 행동·접근성 props만 명시적으로 받는다.
export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

// variant × 상태 → 전경(fg role, Icon·spinner용 hex)·container·pressed·label(class). 한 곳에서 결정.
const VARIANT: Record<
  ButtonVariant,
  { container: string; pressed: string; label: string; fgRole: "primaryFg" | "text" | "primary" }
> = {
  primary: {
    container: "bg-primary",
    pressed: "bg-primary-pressed",
    label: "text-primary-foreground",
    fgRole: "primaryFg",
  },
  secondary: {
    container: "bg-surface border border-border",
    pressed: "bg-surface-alt",
    label: "text-foreground",
    fgRole: "text",
  },
  ghost: { container: "bg-transparent", pressed: "bg-surface-alt", label: "text-primary", fgRole: "primary" },
};

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-[48px]", // Android 최소 터치(IconButton 48과 일관)
  lg: "min-h-[52px]",
};

export function Button({
  label,
  variant = "primary",
  size = "md",
  fullWidth,
  disabled,
  busy,
  icon,
  onPress,
  onPressIn,
  onPressOut,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const v = VARIANT[variant];
  const blocked = !!disabled || !!busy;
  const fg = color(v.fgRole);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: !!busy }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      disabled={blocked}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      testID={testID}
      className={`flex-row items-center justify-center gap-2 rounded-xl px-4 ${SIZE[size]} ${
        fullWidth ? "w-full" : ""
      } ${v.container} ${disabled ? "opacity-50" : ""}`}
    >
      {({ pressed }) => (
        <>
          {/* pressed 배경은 오버레이로(비활성 시 미표시). */}
          {pressed && !blocked ? (
            <View className={`absolute inset-0 rounded-xl ${v.pressed}`} />
          ) : null}
          {busy ? (
            <ActivityIndicator size="small" color={fg} />
          ) : icon ? (
            <Icon name={icon} size={18} color={fg} />
          ) : null}
          <Text className={`text-base font-medium ${v.label}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
