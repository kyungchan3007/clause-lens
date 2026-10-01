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
  it("BrandHeader: 브랜드명 + 프로필 버튼(a11y). onHome 없으면 '홈으로' 미표시", () => {
    const onProfile = jest.fn();
    const root = render(<BrandHeader onProfile={onProfile} />);
    expect(texts(root)).toContain("ClauseLens");
    const btns = root.findAll((n) => n.props.accessibilityRole === "button");
    expect(btns.some((b) => b.props.accessibilityLabel === "마이페이지")).toBe(true);
    expect(btns.some((b) => b.props.accessibilityLabel === "홈으로")).toBe(false);
  });

  it("BrandHeader: onHome 있으면 '홈으로' 버튼 표시·탭 시 onHome 호출", () => {
    const onHome = jest.fn();
    const root = render(<BrandHeader onProfile={jest.fn()} onHome={onHome} />);
    const home = root
      .findAll((n) => n.props.accessibilityRole === "button" && n.props.accessibilityLabel === "홈으로")
      .find((n) => typeof n.props.onPress === "function");
    expect(home).toBeTruthy();
    act(() => home!.props.onPress());
    expect(onHome).toHaveBeenCalledTimes(1);
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
