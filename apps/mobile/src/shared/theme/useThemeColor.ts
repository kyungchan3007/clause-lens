import { color, type SemanticRole } from "@clause-lens/tokens";

// 색 prop(Icon·SVG·네이티브)용 훅(0031). 컴포넌트가 semantic.light를 직접 집지 않고 이걸 쓴다.
// 지금 light 고정 — 다크 도입 시 활성 테마를 읽어 반환하도록 이 훅만 확장(소비자 변경 없음).
export function useThemeColor(): (role: SemanticRole) => string {
  return color;
}
