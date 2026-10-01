import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useAuthStore } from "../../auth";
import { useEntitlementStore } from "../../entitlement";
import { useProfile } from "./useProfile";

// 포커스 = 마운트로 단순화(포커스 콜백이 refresh를 부르는지 검증).
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return { useFocusEffect: (cb: () => void) => useEffect(cb, [cb]) };
});
// auth·entitlement 배럴은 네이티브·UI를 끌어오므로 최소 스토어로 대체.
jest.mock("../../auth", () => {
  const { create } = jest.requireActual("zustand");
  return { useAuthStore: create(() => ({ user: undefined, signOut: jest.fn() })) };
});
jest.mock("../../entitlement", () => {
  const { create } = jest.requireActual("zustand");
  return { useEntitlementStore: create(() => ({ refresh: jest.fn() })) };
});

const signOut = jest.fn();
const refresh = jest.fn();

beforeEach(() => {
  signOut.mockResolvedValue(undefined);
  refresh.mockResolvedValue(undefined);
  useAuthStore.setState({
    user: { id: "u1", displayName: "홍길동", provider: "KAKAO" },
    signOut,
  } as never);
  useEntitlementStore.setState({ refresh } as never);
});

describe("useProfile", () => {
  it("사용자 이름과 로그인 수단 라벨", () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.displayName).toBe("홍길동");
    expect(result.current.providerLabel).toBe("카카오");
  });

  it("로그인 사용자가 없으면 이름 없음·라벨 빈 문자열", () => {
    useAuthStore.setState({ user: undefined } as never);
    const { result } = renderHook(() => useProfile());
    expect(result.current.displayName).toBeUndefined();
    expect(result.current.providerLabel).toBe("");
  });

  it("서버가 displayName null을 주면 그대로 전달(UI가 '사용자'로 폴백)", () => {
    useAuthStore.setState({ user: { id: "u1", displayName: null, provider: "KAKAO" } } as never);
    const { result } = renderHook(() => useProfile());
    expect(result.current.displayName).toBeNull();
  });

  it("화면 포커스 시 무료 잔량 재조회", () => {
    renderHook(() => useProfile());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("로그아웃은 확인 다이얼로그의 '로그아웃'에서만 실행", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useProfile());
    act(() => result.current.confirmSignOut());
    expect(alert).toHaveBeenCalledWith("로그아웃", "로그아웃 하시겠어요?", expect.any(Array));
    expect(signOut).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2]!;
    act(() => buttons.find((b) => b.text === "취소")!.onPress?.());
    expect(signOut).not.toHaveBeenCalled();
    act(() => buttons.find((b) => b.text === "로그아웃")!.onPress!());
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("1:1 문의는 준비 중 안내", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useProfile());
    act(() => result.current.openInquiry());
    expect(alert).toHaveBeenCalledWith("준비 중", "1:1 문의는 곧 제공될 예정이에요.");
  });
});
