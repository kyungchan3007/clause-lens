import { act, renderHook } from "@testing-library/react-native";

import { useAnalysisStore, type AnalysisPhase } from "../../features/analysis";
import { useAuthStore } from "../../features/auth";
import { useAccountResourceSync } from "./useAccountResourceSync";

// auth 배럴은 카카오 네이티브 모듈을 끌어오므로 최소 스토어로 대체.
jest.mock("../../features/auth", () => {
  const { create } = jest.requireActual("zustand");
  return { useAuthStore: create(() => ({ status: "restoring", user: undefined })) };
});

const never = (): boolean => false;

function makeStore() {
  const api = {
    syncAccount: jest.fn(),
    refresh: jest.fn().mockResolvedValue(undefined),
  };
  return { getState: () => api, api };
}

beforeEach(() => {
  useAuthStore.setState({ status: "restoring", user: undefined } as never);
  useAnalysisStore.getState().reset();
});

describe("useAccountResourceSync", () => {
  it("authenticated → syncAccount(userId) + refresh 1회", () => {
    const store = makeStore();
    act(() => useAuthStore.setState({ status: "authenticated", user: { id: "u1" } } as never));
    renderHook(() => useAccountResourceSync(store, { refreshOnPhase: never }));
    expect(store.api.syncAccount).toHaveBeenCalledWith("u1");
    expect(store.api.refresh).toHaveBeenCalledTimes(1);
  });

  it("unauthenticated → syncAccount(null), refresh 안 함", () => {
    const store = makeStore();
    act(() => useAuthStore.setState({ status: "unauthenticated", user: undefined } as never));
    renderHook(() => useAccountResourceSync(store, { refreshOnPhase: never }));
    expect(store.api.syncAccount).toHaveBeenCalledWith(null);
    expect(store.api.refresh).not.toHaveBeenCalled();
  });

  it("restoring → 아무 동작 없음", () => {
    const store = makeStore();
    renderHook(() => useAccountResourceSync(store, { refreshOnPhase: never }));
    expect(store.api.syncAccount).not.toHaveBeenCalled();
    expect(store.api.refresh).not.toHaveBeenCalled();
  });

  it("계정 변경 → 다시 syncAccount(새 userId) + refresh", () => {
    const store = makeStore();
    act(() => useAuthStore.setState({ status: "authenticated", user: { id: "u1" } } as never));
    renderHook(() => useAccountResourceSync(store, { refreshOnPhase: never }));
    store.api.syncAccount.mockClear();
    store.api.refresh.mockClear();
    act(() => useAuthStore.setState({ status: "authenticated", user: { id: "u2" } } as never));
    expect(store.api.syncAccount).toHaveBeenCalledWith("u2");
    expect(store.api.refresh).toHaveBeenCalledTimes(1);
  });

  it("phase 변화 → refreshOnPhase true면 refresh, false면 안 함", () => {
    const store = makeStore();
    const onlyDone = (phase: AnalysisPhase): boolean => phase === "done";
    renderHook(() => useAccountResourceSync(store, { refreshOnPhase: onlyDone }));
    store.api.refresh.mockClear();
    act(() => useAnalysisStore.getState().set({ phase: "analyzing" }));
    expect(store.api.refresh).not.toHaveBeenCalled();
    act(() => useAnalysisStore.getState().set({ phase: "done" }));
    expect(store.api.refresh).toHaveBeenCalledTimes(1);
  });
});
