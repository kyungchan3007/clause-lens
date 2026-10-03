import * as React from "react";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

import { Pager } from "./pager";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const buttons = (root: ReactTestInstance) =>
  root.findAll((n) => n.props.accessibilityRole === "button");
const byLabel = (root: ReactTestInstance, label: string) =>
  buttons(root).find((n) => n.props.accessibilityLabel === label);

describe("Pager", () => {
  it("total<=0 → 렌더하지 않음(없는 페이지 표시 금지)", () => {
    const tree = render(<Pager current={1} total={0} onPrev={() => {}} onNext={() => {}} />);
    expect(tree.toJSON()).toBeNull();
  });

  it("total===1 → 정적 카운터, 화살표 버튼 없음", () => {
    const tree = render(<Pager current={1} total={1} onPrev={() => {}} onNext={() => {}} />);
    expect(buttons(tree.root).length).toBe(0);
    expect(
      tree.root
        .findAll((n) => n.props.accessibilityLabel === "전체 1페이지 중 1페이지")
        .length,
    ).toBeGreaterThan(0);
  });

  it("중간 페이지 → 이전·다음 모두 활성", () => {
    const tree = render(<Pager current={2} total={3} onPrev={() => {}} onNext={() => {}} />);
    expect(byLabel(tree.root, "이전 페이지")?.props.disabled).toBe(false);
    expect(byLabel(tree.root, "다음 페이지")?.props.disabled).toBe(false);
  });

  it("첫 페이지 → 이전 disabled", () => {
    const tree = render(<Pager current={1} total={3} onPrev={() => {}} onNext={() => {}} />);
    expect(byLabel(tree.root, "이전 페이지")?.props.disabled).toBe(true);
    expect(byLabel(tree.root, "다음 페이지")?.props.disabled).toBe(false);
  });

  it("마지막 페이지 → 다음 disabled", () => {
    const tree = render(<Pager current={3} total={3} onPrev={() => {}} onNext={() => {}} />);
    expect(byLabel(tree.root, "이전 페이지")?.props.disabled).toBe(false);
    expect(byLabel(tree.root, "다음 페이지")?.props.disabled).toBe(true);
  });

  it("활성 버튼 onPress가 콜백을 부른다", () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const tree = render(<Pager current={2} total={3} onPrev={onPrev} onNext={onNext} />);
    act(() => byLabel(tree.root, "다음 페이지")?.props.onPress());
    act(() => byLabel(tree.root, "이전 페이지")?.props.onPress());
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});
