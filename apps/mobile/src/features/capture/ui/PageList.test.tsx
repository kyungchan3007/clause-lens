import * as React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// sortables(ESM·reanimated 드래그 내부)는 단위에서 목: Grid는 data를 renderItem으로 펼치고 Handle은 패스스루.
jest.mock("react-native-sortables", () => {
  const r = require("react");
  const { View } = require("react-native");
  const Handle = (props) => r.createElement(r.Fragment, null, props.children);
  const Grid = (props) =>
    r.createElement(
      View,
      { testID: "grid" },
      props.data.map((it, index) =>
        r.createElement(View, { key: props.keyExtractor(it) }, props.renderItem({ item: it, index })),
      ),
    );
  return { __esModule: true, default: { Grid, Handle } };
});

// reanimated(네이티브 worklets)는 단위에서 목 — Animated.ScrollView=RN ScrollView, useAnimatedRef=stub.
jest.mock("react-native-reanimated", () => {
  const { ScrollView } = require("react-native");
  return { __esModule: true, default: { ScrollView }, useAnimatedRef: () => ({ current: null }) };
});

// 디바이스 API 격리 — 훅만 목(expo-image-picker/manipulator 로드 회피).
jest.mock("../model/useImagePicker", () => ({
  useImagePicker: () => ({ captureToDraft: jest.fn(), replaceDraft: jest.fn() }),
}));

import { PageList } from "./PageList";
import { useDraftStore } from "../model/draftStore";
import type { DraftPage } from "../model/types";

function page(n: number): DraftPage {
  return {
    id: `p${n}`,
    localUri: `file://${n}.jpg`,
    thumbUri: `file://${n}.thumb.jpg`,
    order: n,
    width: 1200,
    height: 1600,
    contentType: "image/jpeg",
    sizeBytes: 1000,
  };
}

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
// 보간 Text는 children이 배열(["담은 페이지 ",2,"장"]) → join해 문자열로.
const texts = (r: ReturnType<typeof render>) =>
  r.findAllByType(Text).map((t) => ([] as unknown[]).concat(t.props.children).join(""));

describe("PageList (그리드)", () => {
  afterEach(() => useDraftStore.setState({ pages: [], locked: false, dragging: false }));

  it("담은 장수 헤더 + 페이지 카드들 + +추가 셀 + 분석하기", () => {
    useDraftStore.setState({ pages: [page(0), page(1)], locked: false, dragging: false });
    const r = render(<PageList analyze={{ onAnalyze: jest.fn() }} />);
    const t = texts(r);
    expect(t).toContain("담은 페이지 2장");
    expect(t).toContain("길게 눌러 순서 변경");
    expect(t).toContain("추가"); // AddCell
    expect(t).toContain("분석하기");
    // 페이지 번호 1,2 (배지)
    expect(t).toContain("1");
    expect(t).toContain("2");
  });
});
