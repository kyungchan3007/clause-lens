import * as React from "react";
import * as Lucide from "lucide-react-native";
import { semantic } from "@clause-lens/tokens";

// lucide 아이콘 이름(PascalCase). 예: "Camera", "FileText", "Trash", "Plus".
export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// 도메인은 이 하나의 <Icon>만 쓰고 name/size/color를 props로 넘긴다.
// (lucide → react-native-svg 네이티브 모듈 필요: 실제 렌더는 네이티브 빌드 후)
export function Icon({ name, size = 24, color, strokeWidth = 2 }: IconProps) {
  const map = Lucide as unknown as Record<string, React.ComponentType<any>>;
  const LucideIcon = map[name];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} color={color ?? semantic.light.text} strokeWidth={strokeWidth} />;
}
