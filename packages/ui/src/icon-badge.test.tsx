import * as React from "react";
import { View } from "react-native";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

import { IconBadge } from "./icon-badge";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

// 컨테이너 View들의 className을 합쳐 포함 검사(정적 프리셋 매핑 확인).
const classes = (r: ReactTestInstance) =>
  r.findAllByType(View).map((v) => (v.props.className as string | undefined) ?? "").join(" ");

describe("IconBadge", () => {
  it("기본은 md·circle·primary-tint (기존 사용처와 바이트 동일)", () => {
    const cls = classes(render(<IconBadge name="User" />));
    expect(cls).toContain("h-20 w-20");
    expect(cls).toContain("rounded-full");
    expect(cls).toContain("bg-primary-tint");
  });

  it("box·shape 프리셋이 정적 클래스로 매핑된다", () => {
    const cls = classes(render(<IconBadge name="ShieldCheck" box="lg" shape="rounded" />));
    expect(cls).toContain("h-24 w-24");
    expect(cls).toContain("rounded-3xl");
  });

  it("tone을 주면 그 tone의 배경 클래스", () => {
    expect(classes(render(<IconBadge name="TriangleAlert" tone="danger" />))).toContain(
      "bg-danger-bg",
    );
    expect(classes(render(<IconBadge name="Ticket" tone="warning" shape="rounded" />))).toContain(
      "bg-warning-bg",
    );
  });

  it("className은 컨테이너 뒤에 병합된다", () => {
    expect(classes(render(<IconBadge name="User" className="mb-7" />))).toContain("mb-7");
  });

  it("모든 box·shape 조합에서 크래시 없이 렌더", () => {
    for (const box of ["sm", "md", "lg"] as const) {
      for (const shape of ["circle", "rounded"] as const) {
        expect(() => render(<IconBadge name="User" box={box} shape={shape} />)).not.toThrow();
      }
    }
  });
});
