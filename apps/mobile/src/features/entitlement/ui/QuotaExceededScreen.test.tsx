import * as React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

import { QuotaExceededScreen } from "./QuotaExceededScreen";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const hasText = (r: ReturnType<typeof render>, s: string) =>
  r.findAllByType(Text).some((t) => ([] as unknown[]).concat(t.props.children).join("").includes(s));

describe("QuotaExceededScreen (무료 소진)", () => {
  it("제목·안내·구독 Notice·버튼 렌더", () => {
    const r = render(<QuotaExceededScreen onConfirm={jest.fn()} onViewStatus={jest.fn()} />);
    expect(hasText(r, "무료 분석 횟수가 없어요")).toBe(true);
    expect(hasText(r, "무료 3회를 모두 사용했어요")).toBe(true);
    expect(hasText(r, "곧 구독으로 무제한 분석을 제공할 예정이에요.")).toBe(true);
    expect(hasText(r, "확인")).toBe(true);
    expect(hasText(r, "남은 분석 상태 보기")).toBe(true);
  });

  it("'남은 분석 상태 보기' 탭 → onViewStatus", () => {
    const onViewStatus = jest.fn();
    const r = render(<QuotaExceededScreen onConfirm={jest.fn()} onViewStatus={onViewStatus} />);
    const node = r
      .findAll((n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function")
      .find((n) => {
        try {
          return n.findAllByType(Text).some((t) => String(t.props.children).includes("남은"));
        } catch {
          return false;
        }
      });
    act(() => node!.props.onPress());
    expect(onViewStatus).toHaveBeenCalledTimes(1);
  });
});
