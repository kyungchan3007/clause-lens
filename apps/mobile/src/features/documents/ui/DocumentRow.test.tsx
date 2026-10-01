import * as React from "react";
import renderer, { act } from "react-test-renderer";

import { DocumentRow } from "./DocumentRow";
import type { DocumentListItem } from "@clause-lens/contracts";

function item(over: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    documentId: "d1",
    label: "임대차 계약서",
    status: "done",
    completedAt: "2026-10-01T00:00:00.000Z",
    retainUntil: "2026-10-07T00:00:00.000Z",
    risk: { high: 1, medium: 0, low: 0 },
    analyzedPageCount: 1,
    totalPageCount: 1,
    ...over,
  } as unknown as DocumentListItem;
}

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

describe("DocumentRow — 접근성", () => {
  it("루트(button)에 라벨이 항상 설정되고 제목을 포함 — 썸네일 플레이스홀더 숨김이 안전", () => {
    const r = render(<DocumentRow item={item()} onPress={() => {}} />);
    const btns = r.findAll((n) => n.props.accessibilityRole === "button");
    expect(
      btns.some(
        (b) =>
          typeof b.props.accessibilityLabel === "string" &&
          b.props.accessibilityLabel.includes("임대차 계약서"),
      ),
    ).toBe(true);
  });

  it("partial 문서도 라벨에 분석 장수 포함", () => {
    const r = render(
      <DocumentRow
        item={item({ status: "partial", analyzedPageCount: 2, totalPageCount: 3 })}
        onPress={() => {}}
      />,
    );
    const btns = r.findAll((n) => n.props.accessibilityRole === "button");
    expect(btns.some((b) => String(b.props.accessibilityLabel).includes("2/3장"))).toBe(true);
  });
});
