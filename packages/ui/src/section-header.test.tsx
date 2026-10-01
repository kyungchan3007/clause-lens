import * as React from "react";
import { Text } from "react-native";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

import { SectionHeader } from "./section-header";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const texts = (r: ReactTestInstance) => r.findAllByType(Text);

describe("SectionHeader", () => {
  it("기본(label)은 header role 텍스트, action 없음", () => {
    const root = render(<SectionHeader label="계정" />);
    expect(texts(root).some((t) => t.props.children === "계정")).toBe(true);
    expect(root.findAll((n) => n.props.accessibilityRole === "button")).toHaveLength(0);
  });

  it("action이 있으면 형제 button(라벨·onPress)", () => {
    const onPress = jest.fn();
    const root = render(
      <SectionHeader label="최근 분석" variant="title" action={{ label: "모두 보기", onPress }} />,
    );
    const btns = root.findAll((n) => n.props.accessibilityRole === "button");
    expect(btns.some((n) => n.props.accessibilityLabel === "모두 보기")).toBe(true);
    expect(texts(root).some((t) => t.props.children === "최근 분석")).toBe(true);
  });
});
