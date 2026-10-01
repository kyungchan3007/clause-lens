import * as React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

import { BrandHeader } from "./BrandHeader";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const texts = (r: ReturnType<typeof render>) =>
  r.findAllByType(Text).map((t) => t.props.children);

describe("홈 전용 컴포넌트", () => {
  it("BrandHeader: 브랜드명 + 프로필 버튼(a11y)", () => {
    const onProfile = jest.fn();
    const root = render(<BrandHeader onProfile={onProfile} />);
    expect(texts(root)).toContain("ClauseLens");
    const btn = root.find((n) => n.props.accessibilityRole === "button");
    expect(btn.props.accessibilityLabel).toBe("마이페이지");
  });

  it("Hero: 온보딩 제목·부제", () => {
    const root = render(<Hero />);
    expect(texts(root)).toContain("계약서, 찍기만 하세요");
  });

  it("HowItWorks: 3단계 라벨", () => {
    const root = render(<HowItWorks />);
    const t = texts(root);
    expect(t).toContain("촬영");
    expect(t).toContain("분석");
    expect(t).toContain("하이라이트");
  });
});
