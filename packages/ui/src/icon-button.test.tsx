import * as React from "react";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

import { IconButton } from "./icon-button";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const roleButtons = (root: ReactTestInstance) =>
  root.findAll((n) => n.props.accessibilityRole === "button");

describe("IconButton", () => {
  it("accessibilityLabel 전달 + button role", () => {
    const root = render(<IconButton icon="User" accessibilityLabel="마이페이지" onPress={() => {}} />);
    expect(roleButtons(root).some((n) => n.props.accessibilityLabel === "마이페이지")).toBe(true);
  });

  it("실제 터치 영역 하한(48×48)을 style로 보장", () => {
    const root = render(<IconButton icon="ChevronLeft" accessibilityLabel="뒤로" onPress={() => {}} size={22} />);
    const hit = roleButtons(root).some((n) => {
      const s = Array.isArray(n.props.style) ? Object.assign({}, ...n.props.style) : n.props.style;
      return s && s.minWidth >= 48 && s.minHeight >= 48;
    });
    expect(hit).toBe(true);
  });

  it("disabled 상태 전달", () => {
    const root = render(
      <IconButton icon="User" accessibilityLabel="x" onPress={() => {}} disabled />,
    );
    expect(roleButtons(root).some((n) => n.props.disabled === true)).toBe(true);
  });
});
