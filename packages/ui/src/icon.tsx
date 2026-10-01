import * as React from "react";
import * as Lucide from "lucide-react-native";
import { color as tokenColor } from "@clause-lens/tokens";

// 앱에서 실제 사용하는 lucide 아이콘의 명시 레지스트리(0b-2).
// IconButton/Button 등은 IconName(아래 union)만 받아 오타·빈 버튼을 컴파일 타임에 차단한다.
// (Icon 자체는 하위호환으로 임의 문자열도 받되, 모르는 이름은 dev 경고 + null.)
const map = Lucide as unknown as Record<string, React.ComponentType<any>>;

export const ICON_REGISTRY = {
  Camera: map.Camera,
  Images: map.Images,
  ScanLine: map.ScanLine,
  Sparkles: map.Sparkles,
  ChevronLeft: map.ChevronLeft,
  ChevronRight: map.ChevronRight,
  FileClock: map.FileClock,
  FileText: map.FileText,
  GripVertical: map.GripVertical,
  LogOut: map.LogOut,
  MessageCircleQuestion: map.MessageCircleQuestion,
  Plus: map.Plus,
  RefreshCw: map.RefreshCw,
  Ticket: map.Ticket,
  User: map.User,
  AlertCircle: map.AlertCircle,
  CircleHelp: map.CircleHelp,
  Info: map.Info,
  TriangleAlert: map.TriangleAlert,
  ShieldCheck: map.ShieldCheck,
} satisfies Record<string, React.ComponentType<any>>;

export type IconName = keyof typeof ICON_REGISTRY;

export interface IconProps {
  // 레지스트리 이름 권장. 하위호환으로 임의 문자열도 허용(모르는 이름은 null).
  name: IconName | (string & {});
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// 도메인은 이 하나의 <Icon>만 쓰고 name/size/color를 props로 넘긴다.
export function Icon({ name, size = 24, color, strokeWidth = 2 }: IconProps) {
  const LucideIcon = (ICON_REGISTRY as Record<string, React.ComponentType<any>>)[name] ?? map[name];
  if (!LucideIcon) {
    if (__DEV__) console.warn(`[ui] Icon: unknown name "${name}"`);
    return null;
  }
  return <LucideIcon size={size} color={color ?? tokenColor("text")} strokeWidth={strokeWidth} />;
}
