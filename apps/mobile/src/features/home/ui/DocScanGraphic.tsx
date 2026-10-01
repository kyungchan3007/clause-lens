import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { color } from "@clause-lens/tokens";

// 진행 화면 히어로 그래픽(홈 전용) — 문서 박스 + 플레이스홀더 줄 + 스캔 라인.
// 스캔 라인은 analyze(분석 구간)에서만 상하 이동. reduced-motion이면 정적(중앙 고정).
// 표시 전용(장식) — accessibilityElementsHidden로 스크린리더에서 숨김.
const LINES = [0.88, 0.7, 0.95, 0.6, 0.82, 0.5];

export function DocScanGraphic({ animate }: { animate?: boolean }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setReduceMotion(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!animate || reduceMotion) {
      y.stopAnimation();
      y.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, reduceMotion, y]);

  // 박스 안 세로 이동 범위(패딩 고려): 약 18~150px.
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [16, 150] });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="mb-7 h-40 w-32 overflow-hidden rounded-2xl border border-border bg-surface-alt"
    >
      <View className="gap-[7px] px-[18px] pt-5">
        {LINES.map((w, i) => (
          <View
            key={i}
            className="h-[5px] rounded-full bg-border"
            style={{ width: `${w * 100}%` }}
          />
        ))}
      </View>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: color("primary"),
          transform: [{ translateY }],
        }}
      />
    </View>
  );
}
