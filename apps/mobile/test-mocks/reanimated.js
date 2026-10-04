// jest용 reanimated 목 — worklets 네이티브 init(loadUnpackers) 회피. DragSheet/PageList가 쓰는 표면만.
// 실제 애니메이션 거동은 시뮬레이터 실측. 단위는 순수 로직(drag-sheet.lib)·a11y props·분기 호출만 검증.
// reduce-motion 분기 검증을 위해 useReducedMotion은 토글 가능, withSpring 호출 수는 추적(테스트 훅).
const React = require("react");
const { View, ScrollView, Text, Image } = require("react-native");

let reduceMotion = false;
let springCalls = 0;

const createAnimatedComponent = (Component) => Component;
const Animated = { View, ScrollView, Text, Image, createAnimatedComponent };

module.exports = {
  __esModule: true,
  default: Animated,
  createAnimatedComponent,
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  useAnimatedRef: () => React.createRef(),
  useReducedMotion: () => reduceMotion,
  useEvent: () => () => {},
  withSpring: (toValue) => {
    springCalls += 1;
    return toValue;
  },
  withTiming: (toValue) => toValue,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  Easing: { linear: (t) => t, inOut: (fn) => fn, ease: (t) => t },
  // 테스트 전용 훅(resetMocks에 영향받지 않도록 jest.fn 대신 수동 추적).
  __setReduceMotion: (v) => {
    reduceMotion = !!v;
  },
  __springCalls: () => springCalls,
  __reset: () => {
    reduceMotion = false;
    springCalls = 0;
  },
};
