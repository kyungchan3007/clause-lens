// 색 prop 단일 리졸버(0031) — Icon·SVG·네이티브 요소처럼 className이 아닌 "실제 색 문자열"이
// 필요한 곳의 유일한 해석 지점. 컴포넌트가 semantic.light.X 를 직접 집지 않는다.
// 지금은 light 고정. 다크는 후속에서 활성 테마를 읽도록 이 함수(또는 useThemeColor)만 확장.
const semantic = require("./semantic.js");

const ACTIVE = "light";

// color("text") → 현재 테마의 hex. 잘못된 역할은 조기 실패.
function color(role) {
  const value = semantic[ACTIVE][role];
  if (value == null) throw new Error(`unknown semantic role: ${role}`);
  return value;
}

module.exports = { color };
