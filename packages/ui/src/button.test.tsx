import * as React from "react";
import { ActivityIndicator, Text } from "react-native";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

import { Button } from "./button";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const roleButtons = (root: ReactTestInstance) =>
  root.findAll((n) => n.props.accessibilityRole === "button");

describe("Button", () => {
  it("label 렌더 + button role", () => {
    const root = render(<Button label="분석하기" onPress={() => {}} />);
    expect(root.findAllByType(Text).some((t) => t.props.children === "분석하기")).toBe(true);
    expect(roleButtons(root).length).toBeGreaterThan(0);
  });

  it("disabled면 입력 차단 + accessibilityState.disabled", () => {
    const onPress = jest.fn();
    const root = render(<Button label="x" onPress={onPress} disabled />);
    expect(roleButtons(root).some((n) => n.props.disabled === true)).toBe(true);
    expect(roleButtons(root).some((n) => n.props.accessibilityState?.disabled === true)).toBe(true);
  });

  it("busy면 차단 + busy 상태 + 스피너 + label 유지", () => {
    const root = render(<Button label="전송 중" onPress={() => {}} busy />);
    expect(roleButtons(root).some((n) => n.props.disabled === true)).toBe(true);
    expect(roleButtons(root).some((n) => n.props.accessibilityState?.busy === true)).toBe(true);
    expect(root.findAllByType(ActivityIndicator).length).toBe(1);
    expect(root.findAllByType(Text).some((t) => t.props.children === "전송 중")).toBe(true);
  });

  it("accessibilityLabel 미지정 시 label 사용", () => {
    const root = render(<Button label="돌아가기" onPress={() => {}} />);
    expect(roleButtons(root).some((n) => n.props.accessibilityLabel === "돌아가기")).toBe(true);
  });
});
