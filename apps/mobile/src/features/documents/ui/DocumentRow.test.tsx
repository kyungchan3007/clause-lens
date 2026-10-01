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

const buttons = (r: ReturnType<typeof render>) =>
  r.findAll((n) => n.props.accessibilityRole === "button");

describe("DocumentRow — 접근성", () => {
  it("모든 button 노드에 비어있지 않은 accessibilityLabel(루트 라벨 누락 없음)·제목 포함", () => {
    const r = render(<DocumentRow item={item()} onPress={() => {}} />);
    const btns = buttons(r);
    expect(btns.length).toBeGreaterThan(0);
    // '일부가 아니라' 모든 버튼이 라벨을 가져야 — 라벨 없는 버튼(루트 누락)이 없음을 보장.
    for (const b of btns) {
      expect(typeof b.props.accessibilityLabel).toBe("string");
      expect(b.props.accessibilityLabel.length).toBeGreaterThan(0);
    }
    expect(btns.every((b) => b.props.accessibilityLabel.includes("임대차 계약서"))).toBe(true);
  });

  it("썸네일 플레이스홀더는 스크린리더에서 숨김(장식)", () => {
    const r = render(<DocumentRow item={item()} onPress={() => {}} />);
    const ph = r.findAll((n) => n.props.testID === "doc-thumb-placeholder");
    expect(ph.length).toBeGreaterThan(0);
    expect(
      ph.every(
        (p) =>
          p.props.accessibilityElementsHidden === true &&
          p.props.importantForAccessibility === "no-hide-descendants",
      ),
    ).toBe(true);
  });

  it("label이 빈값이어도 루트 라벨은 '문서' 폴백으로 비어있지 않음", () => {
    const r = render(<DocumentRow item={item({ label: "" })} onPress={() => {}} />);
    const btns = buttons(r);
    expect(btns.every((b) => b.props.accessibilityLabel.includes("문서"))).toBe(true);
  });

  it("partial 문서도 라벨에 분석 장수 포함", () => {
    const r = render(
      <DocumentRow
        item={item({ status: "partial", analyzedPageCount: 2, totalPageCount: 3 })}
        onPress={() => {}}
      />,
    );
    expect(buttons(r).every((b) => String(b.props.accessibilityLabel).includes("2/3장"))).toBe(true);
  });
});
