import * as React from "react";
import { Text } from "react-native";

// 리스트/설정 화면의 muted 섹션 라벨. (예: "자주 묻는 질문", "계정")
export interface SectionHeaderProps {
  label: string;
  className?: string;
}

export function SectionHeader({ label, className }: SectionHeaderProps) {
  return (
    <Text
      className={`px-4 pb-2 pt-6 text-xs font-medium text-foreground-muted ${
        className ?? ""
      }`}
    >
      {label}
    </Text>
  );
}
