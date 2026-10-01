import * as React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

import { Badge } from "./badge";
import type { Tone } from "./tone";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

const TONES: Tone[] = ["neutral", "danger", "warning", "success", "info"];

describe("Badge", () => {
  it("라벨을 렌더한다", () => {
    const root = render(<Badge label="6일 후 삭제" tone="warning" />);
    expect(root.findAllByType(Text).some((t) => t.props.children === "6일 후 삭제")).toBe(true);
  });

  it("모든 tone에서 크래시 없이 렌더(기본 neutral 포함)", () => {
    for (const tone of TONES) {
      const root = render(<Badge label={tone} tone={tone} />);
      expect(root.findAllByType(Text).some((t) => t.props.children === tone)).toBe(true);
    }
    expect(() => render(<Badge label="기본" />)).not.toThrow();
  });

  it("dot을 주면 선행 점과 함께 렌더(크래시 없음)", () => {
    const root = render(<Badge label="무료 분석 3회 남음" tone="info" dot />);
    expect(root.findAllByType(Text).some((t) => t.props.children === "무료 분석 3회 남음")).toBe(true);
  });
});
