// jest용 gesture-handler 목 — 실 GestureDetector는 reanimated 내부(useEvent 등)에 의존.
// GestureDetector는 children 패스스루, Gesture.*()는 체이닝 빌더(노옵). 제스처 거동은 시뮬 실측.
const React = require("react");
const { View } = require("react-native");
function makeBuilder() {
  const builder = {};
  const methods = [
    "activeOffsetY", "activeOffsetX", "failOffsetX", "failOffsetY",
    "onStart", "onUpdate", "onEnd", "onBegin", "onFinalize",
    "enabled", "hitSlop", "simultaneousWithExternalGesture", "requireExternalGestureToFail",
  ];
  methods.forEach((m) => { builder[m] = () => builder; });
  return builder;
}
module.exports = {
  __esModule: true,
  GestureDetector: ({ children }) => React.createElement(React.Fragment, null, children),
  GestureHandlerRootView: ({ children }) => React.createElement(View, null, children),
  Gesture: { Pan: makeBuilder, Tap: makeBuilder, Native: makeBuilder, Simultaneous: (...g) => g[0], Race: (...g) => g[0] },
  gestureHandlerRootHOC: (c) => c,
  Directions: {},
  State: {},
};
