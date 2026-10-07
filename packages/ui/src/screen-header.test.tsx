import * as React from "react";
import { Text } from "react-native";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

import { ScreenHeader } from "./screen-header";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

const texts = (root: ReactTestInstance) =>
  root.findAllByType(Text).map((t) => t.props.children);
const backButton = (root: ReactTestInstance) =>
  root
    .findAll((n) => n.props.accessibilityRole === "button")
    .find((n) => n.props.accessibilityLabel === "뒤로");

describe("ScreenHeader", () => {
  it("title을 헤더로 렌더", () => {
    const root = render(<ScreenHeader title="마이페이지" />);
    expect(texts(root)).toContain("마이페이지");
    expect(
      root.findAllByType(Text).some((t) => t.props.accessibilityRole === "header"),
    ).toBe(true);
  });

  it("subtitle 있으면 렌더, 없으면 미렌더", () => {
    const withSub = render(<ScreenHeader title="최근 분석" subtitle="7일 보관" />);
    expect(texts(withSub)).toContain("7일 보관");
    const noSub = render(<ScreenHeader title="최근 분석" />);
    expect(texts(noSub)).not.toContain("7일 보관");
  });

  it("onBack 있으면 뒤로 버튼(a11y '뒤로') + onPress 발화, 없으면 버튼 없음", () => {
    const onBack = jest.fn();
    const root = render(<ScreenHeader title="마이페이지" onBack={onBack} />);
    const btn = backButton(root);
    expect(btn).toBeDefined();
    act(() => btn?.props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);

    const noBack = render(<ScreenHeader title="마이페이지" />);
    expect(backButton(noBack)).toBeUndefined();
  });

  it("right 슬롯 렌더", () => {
    const root = render(<ScreenHeader title="x" right={<Text>우측</Text>} />);
    expect(texts(root)).toContain("우측");
  });
});
