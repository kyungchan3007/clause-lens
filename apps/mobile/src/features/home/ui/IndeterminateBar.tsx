import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { color } from "@clause-lens/tokens";

// 진행률을 모르는 구간(업로드·분석)의 "작동 중" 표시 — 채움(0→100%)이 아니라
// 좌우로 흐르는 띠. 위치를 주장하지 않으므로 1페이지에서도 멈춰 보이지 않고 가짜 %가 없다.
// reduced-motion일 땐 소비자(ProcessingScreen)가 스피너로 대체하고 이 바는 렌더하지 않는다.
export function IndeterminateBar() {
  const [trackW, setTrackW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const segW = Math.max(48, trackW * 0.4);

  useEffect(() => {
    if (trackW <= 0) return;
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [trackW, x]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-segW, trackW],
  });

  return (
    <View
      testID="indeterminate-bar"
      accessibilityRole="progressbar"
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      className="h-1.5 w-full overflow-hidden rounded-full bg-border"
    >
      <Animated.View
        style={{
          width: segW,
          height: "100%",
          borderRadius: 999,
          backgroundColor: color("primary"),
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}
