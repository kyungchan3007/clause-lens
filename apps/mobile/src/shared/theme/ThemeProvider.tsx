import type { ReactNode } from "react";
import { View } from "react-native";
import { vars } from "nativewind";
import { cssVars } from "@clause-lens/tokens";

// 테마 경로(0031) — 루트에서 semantic 색 변수를 공급한다.
// preset의 `var(--cl-*)`가 이 값으로 해석 → 모든 하위가 semantic className으로 색을 받는다.
// 지금 light 고정. 다크 도입 시 여기서 useColorScheme으로 cssVars("dark") 스왑(변경 1곳).
const lightVars = vars(cssVars("light"));

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <View style={lightVars} className="flex-1 bg-background">
      {children}
    </View>
  );
}
