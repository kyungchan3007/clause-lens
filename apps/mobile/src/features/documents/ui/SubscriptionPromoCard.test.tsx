import * as React from "react";
import { Alert, Text } from "react-native";
import renderer, { act } from "react-test-renderer";

import { SubscriptionPromoCard } from "./SubscriptionPromoCard";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const hasText = (r: ReturnType<typeof render>, s: string) =>
  r.findAllByType(Text).some((t) => ([] as unknown[]).concat(t.props.children).join("").includes(s));

describe("SubscriptionPromoCard (구독 안내)", () => {
  it("제목·부제·구독 버튼 렌더", () => {
    const r = render(<SubscriptionPromoCard />);
    expect(hasText(r, "분석 결과를 계속 보관하세요")).toBe(true);
    expect(hasText(r, "구독 알아보기 (곧 제공)")).toBe(true);
  });

  it("버튼 탭 → '곧 제공' Alert(구독 미구현)", () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const r = render(<SubscriptionPromoCard />);
    const btn = r
      .findAll((n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function")
      .find((n) => {
        try {
          return n.findAllByType(Text).some((t) => String(t.props.children).includes("구독 알아보기"));
        } catch {
          return false;
        }
      });
    act(() => btn!.props.onPress());
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
