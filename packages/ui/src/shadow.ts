import { Platform, type ViewStyle } from "react-native";
import { shadow } from "@clause-lens/tokens";

// tokens의 디자인 값을 플랫폼별 RN style로 변환(어댑터). iOS=shadow props / Android=elevation.
// 두 플랫폼이 동일 결과를 보장하진 않으므로 실측으로 조정.
export const cardShadowStyle: ViewStyle =
  Platform.select<ViewStyle>({
    ios: shadow.card.ios as ViewStyle,
    android: shadow.card.android as ViewStyle,
    default: shadow.card.ios as ViewStyle,
  }) ?? {};
