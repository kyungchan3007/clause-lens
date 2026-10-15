import * as React from "react";
import { Text } from "react-native";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

import { MessageState } from "./message-state";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

const hasText = (r: ReactTestInstance, s: string) =>
  r.findAllByType(Text).some((t) => ([] as unknown[]).concat(t.props.children).join("").includes(s));
const textClasses = (r: ReactTestInstance) =>
  r.findAllByType(Text).map((t) => (t.props.className as string | undefined) ?? "").join(" ");

describe("MessageState", () => {
  it("description만 주면 텍스트만 렌더(아이콘·제목 없음)", () => {
    const r = render(<MessageState description="표시할 결과가 없습니다." />);
    expect(hasText(r, "표시할 결과가 없습니다.")).toBe(true);
  });

  it("title + description 함께 렌더", () => {
    const r = render(
      <MessageState title="보관 기간이 지났어요" description="다시 분석해 주세요." />,
    );
    expect(hasText(r, "보관 기간이 지났어요")).toBe(true);
    expect(hasText(r, "다시 분석해 주세요.")).toBe(true);
  });

  it("tone=danger면 설명에 danger 색 클래스", () => {
    expect(textClasses(render(<MessageState tone="danger" description="실패" />))).toContain(
      "text-danger",
    );
  });

  it("actions 슬롯을 렌더한다", () => {
    const r = render(<MessageState description="x" actions={<Text>다시 시도</Text>} />);
    expect(hasText(r, "다시 시도")).toBe(true);
  });

  it("icon을 줘도 크래시 없이 렌더", () => {
    expect(() => render(<MessageState icon="FileClock" title="t" description="d" />)).not.toThrow();
  });
});
