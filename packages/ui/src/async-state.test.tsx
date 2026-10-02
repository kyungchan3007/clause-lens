import * as React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import renderer, { act } from "react-test-renderer";

import { LoadingIndicator, RetryInline } from "./async-state";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

describe("LoadingIndicator", () => {
  it("로딩: ActivityIndicator + 접근성 라벨", () => {
    const r = render(<LoadingIndicator label="불러오는 중" />);
    const spinners = r.findAllByType(ActivityIndicator);
    expect(spinners).toHaveLength(1);
    expect(spinners[0].props.accessibilityLabel).toBe("불러오는 중");
  });

  it("size prop을 ActivityIndicator로 전달", () => {
    const r = render(<LoadingIndicator label="확인 중" size="small" />);
    expect(r.findAllByType(ActivityIndicator)[0].props.size).toBe("small");
  });
});

describe("RetryInline", () => {
  const button = (r: ReturnType<typeof render>) =>
    r.find((n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function");

  it("에러-재시도: danger 텍스트 렌더 + onPress로 onRetry 호출", () => {
    const onRetry = jest.fn();
    const r = render(<RetryInline onRetry={onRetry} label="다시 시도" />);
    expect(
      r.findAllByType(Text).some((t) => t.props.children === "다시 시도"),
    ).toBe(true);
    const danger = r.findAllByType(Text).find((t) => t.props.children === "다시 시도");
    expect(String(danger?.props.className)).toContain("text-danger");
    act(() => button(r).props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("a11y: accessibilityRole=button, accessibilityLabel 전달", () => {
    const r = render(
      <RetryInline onRetry={jest.fn()} label="잔량" accessibilityLabel="무료 분석 잔량 다시 불러오기" />,
    );
    expect(button(r).props.accessibilityLabel).toBe("무료 분석 잔량 다시 불러오기");
  });

  it("textClassName으로 기본 danger 텍스트 스타일 오버라이드", () => {
    const r = render(
      <RetryInline onRetry={jest.fn()} label="다시 시도" textClassName="text-sm font-semibold text-white" />,
    );
    const t = r.findAllByType(Text).find((x) => x.props.children === "다시 시도");
    expect(t?.props.className).toBe("text-sm font-semibold text-white");
  });

  it("children 지정 시 기본 텍스트 대신 커스텀 노드 렌더", () => {
    const r = render(
      <RetryInline onRetry={jest.fn()} label="무시됨">
        <View testID="badge-slot" />
      </RetryInline>,
    );
    expect(r.findAllByType(Text)).toHaveLength(0);
    expect(r.findAll((n) => n.props.testID === "badge-slot").length).toBeGreaterThan(0);
  });
});
