// jest용 reanimated 목 — worklets 네이티브 init(loadUnpackers) 회피. DragSheet/PageList가 쓰는 표면만.
// 실제 애니메이션 거동은 시뮬레이터 실측, 단위는 순수 로직(drag-sheet.lib)·a11y props만.
const React = require("react");
const { View, ScrollView, Text, Image } = require("react-native");
const createAnimatedComponent = (Component) => Component;
const Animated = { View, ScrollView, Text, Image, createAnimatedComponent };
module.exports = {
  __esModule: true,
  default: Animated,
  createAnimatedComponent,
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  useAnimatedRef: () => React.createRef(),
  useReducedMotion: () => false,
  useEvent: () => () => {},
  withSpring: (toValue) => toValue,
  withTiming: (toValue) => toValue,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  Easing: { linear: (t) => t, inOut: (fn) => fn, ease: (t) => t },
};
