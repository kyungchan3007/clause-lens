import * as React from "react";
import { ActivityIndicator, Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// documentsStore가 auth(@react-native-kakao/user ESM)를 전이 로드 → 목으로 체인 차단.
jest.mock("@react-native-kakao/user", () => ({ login: jest.fn() }));

import { RecentEntryButton } from "./RecentEntryButton";
import { useDocumentsStore } from "../model/documentsStore";
import type { DocumentListItem } from "@clause-lens/contracts";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const hasText = (r: ReturnType<typeof render>, s: string) =>
  r.findAllByType(Text).some((t) => ([] as unknown[]).concat(t.props.children).join("").includes(s));

const item = (id: string): DocumentListItem =>
  ({ documentId: id, label: "계약서", status: "done" }) as unknown as DocumentListItem;

const seed = (patch: Partial<ReturnType<typeof useDocumentsStore.getState>>) =>
  useDocumentsStore.setState(patch as never);

describe("RecentEntryButton", () => {
  afterEach(() => seed({ status: "idle", items: [] }));

  it("loading: 스피너, 진입 텍스트 없음", () => {
    seed({ status: "loading", items: [] });
    const r = render(<RecentEntryButton onSeeAll={jest.fn()} />);
    expect(r.findAllByType(ActivityIndicator).length).toBe(1);
    expect(hasText(r, "최근 분석")).toBe(false);
  });

  it("error: 다시 시도", () => {
    seed({ status: "error", items: [] });
    const r = render(<RecentEntryButton onSeeAll={jest.fn()} />);
    expect(hasText(r, "다시 시도")).toBe(true);
  });

  it("ready & 0건: 아무것도 렌더 안 함(온보딩이 담당)", () => {
    seed({ status: "ready", items: [] });
    const r = render(<RecentEntryButton onSeeAll={jest.fn()} />);
    expect(r.findAllByType(Text).length).toBe(0);
  });

  it("ready & N건: '최근 분석 N건' + 탭 시 onSeeAll", () => {
    seed({ status: "ready", items: [item("a"), item("b"), item("c")] });
    const onSeeAll = jest.fn();
    const r = render(<RecentEntryButton onSeeAll={onSeeAll} />);
    expect(hasText(r, "최근 분석 3건")).toBe(true);
    const btn = r.find(
      (n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function",
    );
    act(() => btn.props.onPress());
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });
});
