jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from "expo-secure-store";

import { clearSession, loadSession, saveSession } from "./secureSession";

const KEY = "cl.auth.session";

describe("secureSession", () => {
  it("saveSession은 단일 JSON 항목으로 원자적 저장", async () => {
    await saveSession({ accessToken: "a", refreshToken: "r" });
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      KEY,
      JSON.stringify({ accessToken: "a", refreshToken: "r" }),
    );
  });

  it("loadSession은 저장된 JSON을 파싱해 반환", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
      JSON.stringify({ accessToken: "a", refreshToken: "r" }),
    );
    await expect(loadSession()).resolves.toEqual({
      accessToken: "a",
      refreshToken: "r",
    });
  });

  it("저장값이 없으면 null", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await expect(loadSession()).resolves.toBeNull();
  });

  it("일부 토큰 누락이면 null(부분 세션 방지)", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
      JSON.stringify({ accessToken: "a" }),
    );
    await expect(loadSession()).resolves.toBeNull();
  });

  it("손상된 JSON이면 키 삭제 후 null", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("{not-json");
    await expect(loadSession()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(KEY);
  });

  it("손상값 삭제가 실패해도 예외 없이 null(복원 흐름 보호)", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("{bad");
    (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error("io"));
    await expect(loadSession()).resolves.toBeNull();
  });

  it("clearSession은 세션 키 삭제", async () => {
    await clearSession();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(KEY);
  });
});
