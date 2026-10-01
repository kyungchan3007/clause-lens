import * as React from "react";
import { View } from "react-native";

import { toneAccent, type Tone } from "./tone";

// 상태 점(장식) — tone 강조색. 색만으로 의미를 전달하지 말 것(인접 텍스트로 severity 명시).
export interface StatusDotProps {
  tone: Tone;
  size?: number;
}

export function StatusDot({ tone, size = 6 }: StatusDotProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: size, backgroundColor: toneAccent(tone) }}
    />
  );
}
