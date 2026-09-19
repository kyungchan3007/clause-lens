jest.mock("../api/authApi");
jest.mock("../lib/secureSession");

import * as authApi from "../api/authApi";
import * as secureSession from "../lib/secureSession";
import { useAuthStore } from "./authStore";

const USER = { id: "u1", provider: "KAKAO", email: null, displayName: "박경찬" };

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ status: "restoring", user: null });
    jest.clearAllMocks();
  });

  describe("restore", () => {
    it("세션이 없으면 unauthenticated", async () => {
      (secureSession.loadSession as jest.Mock).mockResolvedValue(null);
      await useAuthStore.getState().restore();
      expect(useAuthStore.getState().status).toBe("unauthenticated");
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("세션 있고 /auth/me 검증 성공하면 authenticated + user", async () => {
      (secureSession.loadSession as jest.Mock).mockResolvedValue({
        accessToken: "a",
        refreshToken: "r",
      });
      (authApi.fetchMe as jest.Mock).mockResolvedValue(USER);
      await useAuthStore.getState().restore();
      expect(useAuthStore.getState().status).toBe("authenticated");
      expect(useAuthStore.getState().user).toEqual(USER);
    });

    it("검증 실패(만료 등)면 unauthenticated (토큰 존재만으로 인증 안 함)", async () => {
      (secureSession.loadSession as jest.Mock).mockResolvedValue({
        accessToken: "a",
        refreshToken: "r",
      });
      (authApi.fetchMe as jest.Mock).mockRejectedValue(new Error("401"));
      await useAuthStore.getState().restore();
      expect(useAuthStore.getState().status).toBe("unauthenticated");
    });
  });

  describe("setSession", () => {
    it("저장 성공하면 authenticated", async () => {
      (secureSession.saveSession as jest.Mock).mockResolvedValue(undefined);
      await useAuthStore
        .getState()
        .setSession({ accessToken: "a", refreshToken: "r" }, USER);
      expect(secureSession.saveSession).toHaveBeenCalledWith({
        accessToken: "a",
        refreshToken: "r",
      });
      expect(useAuthStore.getState().status).toBe("authenticated");
      expect(useAuthStore.getState().user).toEqual(USER);
    });

    it("저장 실패하면 예외 전파 + 인증 성공 처리 안 함", async () => {
      (secureSession.saveSession as jest.Mock).mockRejectedValue(new Error("io"));
      await expect(
        useAuthStore
          .getState()
          .setSession({ accessToken: "a", refreshToken: "r" }, USER),
      ).rejects.toThrow();
      expect(useAuthStore.getState().status).not.toBe("authenticated");
    });
  });

  describe("signOut", () => {
    it("서버 로그아웃 + 로컬 세션 삭제 후 unauthenticated", async () => {
      (secureSession.loadSession as jest.Mock).mockResolvedValue({
        accessToken: "a",
        refreshToken: "r",
      });
      (authApi.logout as jest.Mock).mockResolvedValue(undefined);
      (secureSession.clearSession as jest.Mock).mockResolvedValue(undefined);
      useAuthStore.setState({ status: "authenticated", user: USER });

      await useAuthStore.getState().signOut();

      expect(authApi.logout).toHaveBeenCalledWith("r");
      expect(secureSession.clearSession).toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe("unauthenticated");
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("저장된 세션이 없어도 로컬 정리 후 unauthenticated", async () => {
      (secureSession.loadSession as jest.Mock).mockResolvedValue(null);
      (secureSession.clearSession as jest.Mock).mockResolvedValue(undefined);
      useAuthStore.setState({ status: "authenticated", user: USER });

      await useAuthStore.getState().signOut();

      expect(authApi.logout).not.toHaveBeenCalled();
      expect(secureSession.clearSession).toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe("unauthenticated");
    });
  });
});
