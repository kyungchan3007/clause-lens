import * as React from "react";
import renderer, { act, type ReactTestInstance } from "react-test-renderer";

// 렌더 전용 화면의 동작 불변 가드: 로그아웃/1:1 문의 행이 useProfile 콜백을 호출하는지.
// 하위 subcomponent(FreeQuotaRow=entitlement store, FaqSection=FAQ 데이터)는 목으로 격리.
const mockSignOut = jest.fn();
const mockInquiry = jest.fn();

jest.mock("../model/useProfile", () => ({
  useProfile: () => ({
    displayName: "홍길동",
    providerLabel: "카카오",
    confirmSignOut: mockSignOut,
    openInquiry: mockInquiry,
  }),
}));
jest.mock("../../entitlement", () => ({ FreeQuotaRow: () => null }));
jest.mock("./FaqSection", () => ({ FaqSection: () => null }));

import { ProfileScreen } from "./ProfileScreen";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}

const buttonByLabel = (root: ReactTestInstance, label: string) =>
  root
    .findAll((n) => n.props.accessibilityRole === "button")
    .find((n) => n.props.accessibilityLabel === label);

describe("ProfileScreen", () => {
  it("displayName·provider 렌더", () => {
    const root = render(<ProfileScreen />);
    // 모든 텍스트 노드의 children을 평탄화(provider 줄은 보간 배열이라 문자열 단일 매칭 불가).
    const flat = root
      .findAll((n) => n.props.children != null)
      .flatMap((n) => (Array.isArray(n.props.children) ? n.props.children : [n.props.children]))
      .filter((c) => typeof c === "string")
      .join(" ");
    expect(flat).toContain("홍길동");
    expect(flat).toContain("카카오");
  });

  it("로그아웃 행 탭 → confirmSignOut 호출", () => {
    const root = render(<ProfileScreen />);
    const btn = buttonByLabel(root, "로그아웃");
    expect(btn).toBeDefined();
    act(() => btn?.props.onPress());
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("1:1 문의 행 탭 → openInquiry 호출", () => {
    const root = render(<ProfileScreen />);
    const btn = buttonByLabel(root, "1:1 문의");
    expect(btn).toBeDefined();
    act(() => btn?.props.onPress());
    expect(mockInquiry).toHaveBeenCalledTimes(1);
  });
});
