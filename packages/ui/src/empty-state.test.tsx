import * as React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

import { EmptyState } from "./empty-state";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

describe("EmptyState", () => {
  it("title·subtitle·actions 렌더", () => {
    const root = render(
      <EmptyState
        icon="FileText"
        title="계약서를 담아주세요"
        subtitle="촬영하거나 갤러리에서 불러올 수 있어요"
        actions={<Text>액션버튼</Text>}
      />,
    );
    const texts = root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain("계약서를 담아주세요");
    expect(texts).toContain("촬영하거나 갤러리에서 불러올 수 있어요");
    expect(texts).toContain("액션버튼");
  });

  it("subtitle·actions 없어도 렌더", () => {
    expect(() => render(<EmptyState icon="FileClock" title="없음" />)).not.toThrow();
  });
});
