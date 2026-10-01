import * as React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

import { Notice } from "./notice";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

describe("Notice", () => {
  it("children 텍스트를 렌더", () => {
    const root = render(<Notice tone="info" icon="Info">참고용이며 법률 자문을 대체하지 않아요.</Notice>);
    expect(
      root.findAllByType(Text).some((t) => t.props.children === "참고용이며 법률 자문을 대체하지 않아요."),
    ).toBe(true);
  });
  it("아이콘·tone 없이도 렌더", () => {
    expect(() => render(<Notice>안내</Notice>)).not.toThrow();
  });
});
