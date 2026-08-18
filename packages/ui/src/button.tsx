import * as React from "react";
import { Pressable, Text, type PressableProps } from "react-native";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: ButtonVariant;
}

// 스타일은 토큰(semantic) → NativeWind className 으로. 값 하드코딩 없음.
const containerByVariant: Record<ButtonVariant, string> = {
  primary: "bg-primary active:bg-primary-pressed",
  secondary: "bg-surface border border-border active:bg-surface-alt",
  ghost: "bg-transparent active:bg-surface-alt",
};

const labelByVariant: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-foreground",
  ghost: "text-primary",
};

export function Button({ label, variant = "primary", ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`h-12 flex-row items-center justify-center rounded-xl px-4 ${containerByVariant[variant]}`}
      {...props}
    >
      <Text className={`text-base font-medium ${labelByVariant[variant]}`}>{label}</Text>
    </Pressable>
  );
}
