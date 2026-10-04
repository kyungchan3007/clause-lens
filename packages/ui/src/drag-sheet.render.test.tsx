import * as React from "react";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

import { DragSheet } from "./drag-sheet";

// 컴포넌트 렌더 레벨 a11y 검증(순수 로직은 drag-sheet.test.ts). reanimated/gesture-handler는
// jest.after-env에서 목 — 애니메이션/제스처 실거동은 시뮬 실측. 여기선 핸들 a11y·토글 콜백만 본다.
function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

// 시트는 컨테이너 높이를 onLayout으로 재므로, 측정 전엔 핸들이 렌더되지 않는다. 레이아웃을 흘려준다.
function fireLayout(root: ReactTestInstance, height = 800) {
  const outer = root.find(
    (n) => typeof n.props.onLayout === "function" && n.props.pointerEvents === "box-none",
  );
  act(() => {
    outer.props.onLayout({ nativeEvent: { layout: { width: 400, height } } });
  });
}

const handle = (root: ReactTestInstance, label: string) =>
  root
    .findAll((n) => n.props.accessibilityRole === "button")
    .find((n) => n.props.accessibilityLabel === label);

const SNAPS = [0.5, 1];

describe("DragSheet (render a11y)", () => {
  it("측정 후 핸들이 a11y 버튼으로 렌더된다(role·label·hitSlop)", () => {
    const tree = render(
      <DragSheet index={0} onIndexChange={() => {}} snapPoints={SNAPS} handleLabel="조항 보기 전환">
        <></>
      </DragSheet>,
    );
    fireLayout(tree.root);
    const h = handle(tree.root, "조항 보기 전환");
    expect(h).toBeDefined();
    expect(h?.props.hitSlop).toBeTruthy();
  });

  it("collapsed(index 0) → accessibilityState.expanded=false", () => {
    const tree = render(
      <DragSheet index={0} onIndexChange={() => {}} snapPoints={SNAPS} handleLabel="h">
        <></>
      </DragSheet>,
    );
    fireLayout(tree.root);
    expect(handle(tree.root, "h")?.props.accessibilityState?.expanded).toBe(false);
  });

  it("full(마지막 index) → accessibilityState.expanded=true", () => {
    const tree = render(
      <DragSheet index={1} onIndexChange={() => {}} snapPoints={SNAPS} handleLabel="h">
        <></>
      </DragSheet>,
    );
    fireLayout(tree.root);
    expect(handle(tree.root, "h")?.props.accessibilityState?.expanded).toBe(true);
  });

  it("핸들 탭 → onIndexChange(양끝 토글) 호출 (드래그 대체 경로)", () => {
    const onIndexChange = jest.fn();
    const tree = render(
      <DragSheet index={0} onIndexChange={onIndexChange} snapPoints={SNAPS} handleLabel="h">
        <></>
      </DragSheet>,
    );
    fireLayout(tree.root);
    act(() => handle(tree.root, "h")?.props.onPress());
    expect(onIndexChange).toHaveBeenCalledWith(1); // 0 → 마지막(1)
  });
});

// reduce-motion 게이트 검증 — 목의 useReducedMotion 토글 + withSpring 호출 추적으로
// "감소 요청 시 애니메이션 비사용(즉시 점프)" 분기를 재현. (시각적 모션 자체는 시뮬 실측.)
describe("DragSheet reduce-motion 분기", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RA = require("react-native-reanimated");
  afterEach(() => RA.__reset());

  it("reduce-motion off → withSpring 사용(애니메이션 경로)", () => {
    RA.__reset();
    const tree = render(
      <DragSheet index={0} onIndexChange={() => {}} snapPoints={SNAPS} handleLabel="h">
        <></>
      </DragSheet>,
    );
    fireLayout(tree.root);
    expect(RA.__springCalls()).toBeGreaterThan(0);
  });

  it("reduce-motion on → withSpring 미사용(즉시 점프)", () => {
    RA.__reset();
    RA.__setReduceMotion(true);
    const tree = render(
      <DragSheet index={0} onIndexChange={() => {}} snapPoints={SNAPS} handleLabel="h">
        <></>
      </DragSheet>,
    );
    fireLayout(tree.root);
    expect(RA.__springCalls()).toBe(0);
  });
});
