import * as React from "react";
import { ActivityIndicator, Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import type { EntitlementResponse } from "@clause-lens/contracts";

import { FreeQuotaChip } from "./FreeQuotaChip";
import { useEntitlementStore } from "../model/entitlementStore";

// store가 auth(getAccessToken)를 통해 끌어오는 네이티브 모듈 그래프(kakao) 로드 방지.
jest.mock("../../auth", () => ({ getAccessToken: jest.fn() }));

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const texts = (r: ReturnType<typeof render>) =>
  r.findAllByType(Text).map((t) => t.props.children);

const ent = (remaining: number): EntitlementResponse => ({
  freeGranted: 3,
  freeConsumed: 3 - remaining,
  freeReserved: 0,
  freeRemaining: remaining,
});
function setStore(over: Partial<ReturnType<typeof useEntitlementStore.getState>>) {
  useEntitlementStore.setState({
    status: "idle",
    data: null,
    staleError: false,
    generation: 0,
    userId: "u1",
    inFlight: false,
    pending: false,
    ...over,
  } as never);
}

describe("FreeQuotaChip 상태 분기", () => {
  it("idle·값 없음 → 숨김(0 대체 금지)", () => {
    setStore({ status: "idle", data: null });
    const root = render(<FreeQuotaChip />);
    expect(root.findAllByType(Text)).toHaveLength(0);
  });

  it("최초 loading → 확인 중(스피너)", () => {
    setStore({ status: "loading", data: null });
    const root = render(<FreeQuotaChip />);
    expect(root.findAllByType(ActivityIndicator).length).toBe(1);
  });

  it("ready → 서버 잔량 표시", () => {
    setStore({ status: "ready", data: ent(2) });
    const root = render(<FreeQuotaChip />);
    expect(texts(root).some((c) => String(c).includes("2회 남음"))).toBe(true);
  });

  it("ready + stale → 잔량 + 최신 확인 실패", () => {
    setStore({ status: "ready", data: ent(1), staleError: true });
    const root = render(<FreeQuotaChip />);
    expect(texts(root).some((c) => String(c).includes("1회 남음"))).toBe(true);
    expect(texts(root).some((c) => String(c).includes("최신 확인 실패"))).toBe(true);
  });

  it("최초 error·값 없음 → 다시 시도", () => {
    setStore({ status: "error", data: null });
    const root = render(<FreeQuotaChip />);
    expect(root.findAll((n) => n.props.accessibilityRole === "button").length).toBeGreaterThan(0);
  });
});
