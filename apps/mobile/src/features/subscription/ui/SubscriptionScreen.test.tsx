import * as React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

jest.mock("../api/billingApi", () => ({ identify: jest.fn(), fetchAccess: jest.fn() }));
jest.mock("../../auth", () => ({ getAccessToken: jest.fn(async () => "tok") }));

import { FakePurchases } from "../model/fakePurchases";
import { useSubscriptionStore } from "../model/subscriptionStore";
import { SubscriptionScreen } from "./SubscriptionScreen";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const hasText = (r: ReturnType<typeof render>, s: string) =>
  r.findAllByType(Text).some((t) => ([] as unknown[]).concat(t.props.children).join("").includes(s));
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

function reset() {
  useSubscriptionStore.setState({
    generation: 0, userId: null, offeringsStatus: "idle", plans: [], flow: "idle", inFlight: false,
    _wait: async () => undefined, _timing: { baseMs: 0, maxAttempts: 2, deadlineMs: 1_000_000 },
  });
  useSubscriptionStore.getState().__configureForTest({ _port: new FakePurchases() });
}

beforeEach(reset);

describe("SubscriptionScreen", () => {
  it("마운트 → 플랜 로드·렌더", async () => {
    const r = render(<SubscriptionScreen />);
    await flush();
    expect(hasText(r, "프로 월간")).toBe(true);
    expect(hasText(r, "구독하기")).toBe(true);
  });

  it("flow=delayed → 확인 지연 안내 + 다시 확인", async () => {
    const r = render(<SubscriptionScreen />);
    await flush();
    act(() => useSubscriptionStore.setState({ flow: "delayed" }));
    expect(hasText(r, "확인이 지연되고 있어요")).toBe(true);
    expect(hasText(r, "다시 확인")).toBe(true);
  });

  it("flow=active → 활성 안내", async () => {
    const r = render(<SubscriptionScreen />);
    await flush();
    act(() => useSubscriptionStore.setState({ flow: "active" }));
    expect(hasText(r, "구독이 활성화")).toBe(true);
  });

  it("flow=conflict → 중립 안내(타 소유자 비노출)", async () => {
    const r = render(<SubscriptionScreen />);
    await flush();
    act(() => useSubscriptionStore.setState({ flow: "conflict" }));
    expect(hasText(r, "구매를 연결하지 못했어요")).toBe(true);
  });

  it("구독하기 탭 → purchase(planId) 호출", async () => {
    const purchase = jest.fn();
    const r = render(<SubscriptionScreen />);
    await flush();
    act(() => useSubscriptionStore.setState({ purchase }));
    const btn = r
      .findAll((n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function")
      .find((n) => {
        try {
          return n.findAllByType(Text).some((t) => String(t.props.children).includes("구독하기"));
        } catch {
          return false;
        }
      });
    act(() => btn!.props.onPress());
    expect(purchase).toHaveBeenCalledWith("clauselens_pro_monthly");
  });
});
