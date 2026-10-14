import * as React from "react";
import { View } from "react-native";
import { color as tokenColor } from "@clause-lens/tokens";

import { Icon } from "./icon";
import { toneAccent, toneClasses, type Tone } from "./tone";

// 둥근 배경 + 아이콘. 빈 상태·프로필 아바타·히어로 등에서 공통으로 쓰는 배지.
// 기본은 primary tint. tone을 주면 그 tone의 배경(50대)+강조색(600) 조합(예: success=초록 안심).
// 크기·모양은 정적 프리셋(box·shape)으로 — NativeWind 컴파일러가 정적 클래스만 인식하므로
// 동적 className 조립 대신 고정 맵을 쓴다. 기본값(md·circle)은 기존 사용처와 바이트 동일.
export type IconBadgeSize = "sm" | "md" | "lg";
export type IconBadgeShape = "circle" | "rounded";

const BOX: Record<IconBadgeSize, string> = {
  sm: "h-7 w-7",
  md: "h-20 w-20",
  lg: "h-24 w-24",
};
const SHAPE: Record<IconBadgeShape, string> = {
  circle: "rounded-full",
  rounded: "rounded-3xl",
};

export interface IconBadgeProps {
  name: string;
  // 아이콘(글리프) 크기(px).
  size?: number;
  color?: string;
  tone?: Tone;
  // 컨테이너 크기 프리셋(기본 md=h-20 w-20).
  box?: IconBadgeSize;
  // 컨테이너 모양(기본 circle=rounded-full).
  shape?: IconBadgeShape;
  // 컨테이너에 덧붙일 클래스(여백 등). box·shape 뒤에 추가된다.
  className?: string;
}

export function IconBadge({
  name,
  size = 36,
  color,
  tone,
  box = "md",
  shape = "circle",
  className,
}: IconBadgeProps) {
  const bg = tone ? toneClasses(tone).container : "bg-primary-tint";
  const glyphColor = color ?? (tone ? toneAccent(tone) : tokenColor("primary"));
  return (
    <View
      className={`${BOX[box]} items-center justify-center ${SHAPE[shape]} ${bg} ${className ?? ""}`}
    >
      <Icon name={name} size={size} color={glyphColor} />
    </View>
  );
}
