import * as React from "react";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

// 라우트 공통 셸 — 안전영역(노치·홈바) inset + 배경을 한곳에.
// headerShown:false 라우트가 매번 손으로 깔던 `SafeAreaView + flex-1 bg-background`의 단일 소스.
// edges 기본 top+bottom. 중앙 정렬·패딩 등 변형은 className으로 덧붙인다(뒤에 병합).
export interface ScreenProps {
  children: React.ReactNode;
  edges?: readonly Edge[];
  className?: string;
}

export function Screen({ children, edges = ["top", "bottom"], className }: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className={`flex-1 bg-background ${className ?? ""}`}>
      {children}
    </SafeAreaView>
  );
}
