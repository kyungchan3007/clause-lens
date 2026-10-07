import * as React from "react";
import { Text } from "react-native";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

import { ListRow } from "./list-row";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

// role=button을 가진 모든 인스턴스(composite+host 중복 포함) — prop은 .some으로 확인.
function withButtonRole(root: ReactTestInstance) {
  return root.findAll((n) => n.props.accessibilityRole === "button");
}

describe("ListRow", () => {
  it("onPress 있으면 행이 button(press 영역)", () => {
    const root = render(<ListRow title="문서" onPress={() => {}} />);
    expect(withButtonRole(root).length).toBeGreaterThan(0);
  });

  it("onPress 없으면 button 없음(비상호작용)", () => {
    const root = render(<ListRow title="문서" />);
    expect(withButtonRole(root)).toHaveLength(0);
  });

  it("accessibilityLabel 미지정 시 title로 대체", () => {
    const root = render(<ListRow title="임대차 계약서" onPress={() => {}} />);
    expect(withButtonRole(root).some((n) => n.props.accessibilityLabel === "임대차 계약서")).toBe(
      true,
    );
  });

  it("disabled면 비활성 전달", () => {
    const root = render(<ListRow title="x" onPress={() => {}} disabled />);
    expect(withButtonRole(root).some((n) => n.props.disabled === true)).toBe(true);
  });

  it("supporting이 node면 그대로, string이면 보조 Text로", () => {
    const nodeRoot = render(<ListRow title="x" supporting={<Text>meta-node</Text>} />);
    expect(nodeRoot.findAllByType(Text).some((t) => t.props.children === "meta-node")).toBe(true);
    const strRoot = render(<ListRow title="제목" supporting="보조문구" />);
    expect(strRoot.findAllByType(Text).some((t) => t.props.children === "보조문구")).toBe(true);
  });

  // 제목 Text(numberOfLines=1)의 색 톤 — default=foreground, danger=danger 토큰.
  const titleOf = (root: ReactTestInstance) =>
    root.findAll((n) => n.type === Text && n.props.numberOfLines === 1)[0];

  it("tone 기본은 text-foreground 제목", () => {
    const root = render(<ListRow title="로그인" />);
    expect(titleOf(root).props.className).toContain("text-foreground");
    expect(titleOf(root).props.className).not.toContain("text-danger");
  });

  it('tone="danger"면 제목이 text-danger', () => {
    const root = render(<ListRow title="로그아웃" tone="danger" onPress={() => {}} />);
    expect(titleOf(root).props.className).toContain("text-danger");
  });
});
