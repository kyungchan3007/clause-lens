import { act, renderHook } from "@testing-library/react-native";

import { useAuthStore } from "../../features/auth";
import { useResultSessionReset } from "./useResultSessionReset";

// auth 배럴은 카카오 네이티브 모듈을 끌어오므로 최소 스토어로 대체.
jest.mock("../../features/auth", () => {
  const { create } = jest.requireActual("zustand");
  return { useAuthStore: create(() => ({ user: undefined })) };
});

const mockAnalysisReset = jest.fn();
const mockUploadReset = jest.fn();
jest.mock("../../features/analysis", () => ({
  useAnalysisStore: { getState: () => ({ reset: mockAnalysisReset }) },
}));
jest.mock("../../features/upload", () => ({
  useUploadStore: { getState: () => ({ reset: mockUploadReset }) },
}));

beforeEach(() => {
  mockAnalysisReset.mockClear();
  mockUploadReset.mockClear();
  useAuthStore.setState({ user: undefined } as never);
});

describe("useResultSessionReset", () => {
  it("최초 마운트에서는 리셋하지 않음(빈 스토어)", () => {
    act(() => useAuthStore.setState({ user: { id: "u1" } } as never));
    renderHook(() => useResultSessionReset());
    expect(mockAnalysisReset).not.toHaveBeenCalled();
    expect(mockUploadReset).not.toHaveBeenCalled();
  });

  it("계정 변경(u1→u2) → analysis·upload 리셋", () => {
    act(() => useAuthStore.setState({ user: { id: "u1" } } as never));
    renderHook(() => useResultSessionReset());
    act(() => useAuthStore.setState({ user: { id: "u2" } } as never));
    expect(mockAnalysisReset).toHaveBeenCalledTimes(1);
    expect(mockUploadReset).toHaveBeenCalledTimes(1);
  });

  it("로그아웃(u1→null) → analysis·upload 리셋", () => {
    act(() => useAuthStore.setState({ user: { id: "u1" } } as never));
    renderHook(() => useResultSessionReset());
    act(() => useAuthStore.setState({ user: undefined } as never));
    expect(mockAnalysisReset).toHaveBeenCalledTimes(1);
    expect(mockUploadReset).toHaveBeenCalledTimes(1);
  });

  it("동일 계정 유지(재렌더) → 리셋 없음", () => {
    act(() => useAuthStore.setState({ user: { id: "u1" } } as never));
    const { rerender } = renderHook(() => useResultSessionReset());
    rerender({});
    act(() => useAuthStore.setState({ user: { id: "u1" } } as never)); // 같은 id
    expect(mockAnalysisReset).not.toHaveBeenCalled();
    expect(mockUploadReset).not.toHaveBeenCalled();
  });
});
