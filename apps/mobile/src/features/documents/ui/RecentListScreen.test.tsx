import * as React from "react";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

// documentsStore를 목으로 — 셀렉터를 고정 상태에 적용. 테스트별 상태는 mockStoreState 변이.
const mockStoreState: {
  status: string;
  items: unknown[];
  refreshing: boolean;
  loadingMore: boolean;
  nextCursor: string | null;
  refresh: jest.Mock;
  loadMore: jest.Mock;
} = {
  status: "ready",
  items: [],
  refreshing: false,
  loadingMore: false,
  nextCursor: null,
  refresh: jest.fn(),
  loadMore: jest.fn(),
};

jest.mock("../model/documentsStore", () => ({
  useDocumentsStore: (sel: (s: typeof mockStoreState) => unknown) => sel(mockStoreState),
}));

import { RecentListScreen } from "./RecentListScreen";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

const allStrings = (root: ReactTestInstance) =>
  root
    .findAll((n) => n.props.children != null)
    .flatMap((n) => (Array.isArray(n.props.children) ? n.props.children : [n.props.children]))
    .filter((c) => typeof c === "string");

const backButton = (root: ReactTestInstance) =>
  root
    .findAll((n) => n.props.accessibilityRole === "button")
    .find((n) => n.props.accessibilityLabel === "뒤로");

describe("RecentListScreen", () => {
  beforeEach(() => {
    mockStoreState.status = "ready";
    mockStoreState.items = [];
    mockStoreState.refresh.mockClear();
  });

  it("헤더: 제목 '최근 분석' + 부제가 헤더에 노출(ListHeader 아님)", () => {
    const root = render(<RecentListScreen onOpen={() => {}} onBack={() => {}} />);
    const strings = allStrings(root);
    expect(strings).toContain("최근 분석");
    expect(strings).toContain("분석 결과는 7일 동안 보관돼요.");
  });

  it("뒤로 버튼(a11y '뒤로') → onBack 발화", () => {
    const onBack = jest.fn();
    const root = render(<RecentListScreen onOpen={() => {}} onBack={onBack} />);
    const btn = backButton(root);
    expect(btn).toBeDefined();
    act(() => btn?.props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("items 비면 공용 EmptyState 노출", () => {
    const root = render(<RecentListScreen onOpen={() => {}} onBack={() => {}} />);
    expect(allStrings(root)).toContain("아직 분석한 계약서가 없어요");
  });
});
