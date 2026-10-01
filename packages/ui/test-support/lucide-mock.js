// lucide-react-native는 ESM이라 jest transform 경계에서 파싱 문제가 날 수 있다.
// 단위 테스트는 실제 아이콘 렌더가 목적이 아니므로, 어떤 아이콘 이름이든 가벼운 더미 컴포넌트로 대체.
const React = require("react");

module.exports = new Proxy(
  {},
  {
    get: () => (props) => React.createElement("LucideIcon", props),
  },
);
