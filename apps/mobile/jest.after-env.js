// 제스처/애니메이션 모듈을 jest에서 목.
// @clause-lens/ui 배럴이 DragSheet→reanimated/gesture-handler를 끌어오는데,
// jest(네이티브 없음)에서 reanimated/worklets 실모듈은 네이티브 init(loadUnpackers)에서 실패한다.
// reanimated 공식 mock도 worklets 네이티브를 끌어오므로, worklets 의존 없는 최소 mock을 직접 둔다.
// (실제 애니메이션/제스처 거동은 시뮬레이터 실측 — 단위는 순수 로직만 검증.)
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View, ScrollView, Text, Image } = require("react-native");
  const createAnimatedComponent = (Component) => Component;
  const Animated = {
    View,
    ScrollView,
    Text,
    Image,
    createAnimatedComponent,
  };
  return {
    __esModule: true,
    default: Animated,
    createAnimatedComponent,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    useAnimatedRef: () => React.createRef(),
    useReducedMotion: () => false,
    withSpring: (toValue) => toValue,
    withTiming: (toValue) => toValue,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    Easing: { linear: (t) => t, inOut: (fn) => fn, ease: (t) => t },
  };
});

require("react-native-gesture-handler/jestSetup");
