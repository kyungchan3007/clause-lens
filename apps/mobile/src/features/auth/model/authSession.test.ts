import * as authApi from "../api/authApi";
import { AuthRefreshRejectedError } from "../api/authApi";
import { clearSession, loadSession, saveSession } from "../lib/secureSession";
import { refreshAccess, setOnAuthLost } from "./authSession";

jest.mock("../lib/secureSession");

const mockLoad = loadSession as jest.MockedFunction<typeof loadSession>;
const mockSave = saveSession as jest.MockedFunction<typeof saveSession>;
const mockClear = clearSession as jest.MockedFunction<typeof clearSession>;

const session = (accessToken: string, refreshToken = "r") => ({ accessToken, refreshToken });
const authResult = (accessToken: string, refreshToken: string) => ({
  accessToken,
  refreshToken,
  user: { id: "u", provider: "kakao", email: null, displayName: null },
});

beforeEach(() => {
  jest.restoreAllMocks();
  mockLoad.mockReset();
  mockSave.mockReset().mockResolvedValue(undefined);
  mockClear.mockReset().mockResolvedValue(undefined);
  setOnAuthLost(null);
});

describe("authSession.refreshAccess", () => {
  it("성공: 새 세션 저장 후 새 access 반환", async () => {
    mockLoad.mockResolvedValue(session("stale"));
    jest.spyOn(authApi, "refresh").mockResolvedValue(authResult("fresh", "r2"));

    const token = await refreshAccess("stale");

    expect(token).toBe("fresh");
    expect(mockSave).toHaveBeenCalledWith({ accessToken: "fresh", refreshToken: "r2" });
  });

  it("single-flight: 동시 401은 refresh 1회로 합류", async () => {
    mockLoad.mockResolvedValue(session("stale"));
    const spy = jest
      .spyOn(authApi, "refresh")
      .mockResolvedValue(authResult("fresh", "r2"));

    const [a, b] = await Promise.all([refreshAccess("stale"), refreshAccess("stale")]);

    expect(a).toBe("fresh");
    expect(b).toBe("fresh");
    expect(spy).toHaveBeenCalledTimes(1); // 합류 — refresh 한 번만
  });

  it("이미 갱신돼 토큰이 바뀌었으면 네트워크 없이 현재 토큰 반환(늦은 401)", async () => {
    mockLoad.mockResolvedValue(session("already-new"));
    const spy = jest.spyOn(authApi, "refresh");

    const token = await refreshAccess("stale"); // prev≠현재

    expect(token).toBe("already-new");
    expect(spy).not.toHaveBeenCalled();
  });

  it("확정 인증 실패(refresh 거부) → 세션 정리 + onAuthLost, throw", async () => {
    mockLoad.mockResolvedValue(session("stale"));
    jest.spyOn(authApi, "refresh").mockRejectedValue(new AuthRefreshRejectedError());
    const onLost = jest.fn();
    setOnAuthLost(onLost);

    await expect(refreshAccess("stale")).rejects.toBeInstanceOf(AuthRefreshRejectedError);
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it("일시 장애(네트워크·5xx)는 세션 유지(정리·onAuthLost 안 함)", async () => {
    mockLoad.mockResolvedValue(session("stale"));
    jest.spyOn(authApi, "refresh").mockRejectedValue(new Error("세션 갱신 실패 (503)"));
    const onLost = jest.fn();
    setOnAuthLost(onLost);

    await expect(refreshAccess("stale")).rejects.toThrow(/503/);
    expect(mockClear).not.toHaveBeenCalled();
    expect(onLost).not.toHaveBeenCalled();
  });

  it("경합: refresh 중 세션이 바뀌면(refreshToken 불일치) 새 세션을 덮어쓰지 않음", async () => {
    // 시작 시 세션 A, refresh 성공 후 재조회 시 세션 B(로그인/로그아웃 경합)
    mockLoad
      .mockResolvedValueOnce(session("stale", "rA")) // doRefresh 시작 read
      .mockResolvedValueOnce(session("B-access", "rB")); // 저장 전 재조회
    jest.spyOn(authApi, "refresh").mockResolvedValue(authResult("fresh", "rA2"));

    const token = await refreshAccess("stale");

    expect(mockSave).not.toHaveBeenCalled(); // 새 세션 B를 덮어쓰지 않음
    expect(token).toBe("B-access"); // 현재(새) 세션 토큰으로 진행
  });

  it("확정 실패라도 그 사이 세션이 바뀌었으면 정리하지 않음(새 세션 보호)", async () => {
    mockLoad
      .mockResolvedValueOnce(session("stale", "rA")) // 시작 read
      .mockResolvedValueOnce(session("B-access", "rB")); // 실패 처리 전 재조회
    jest.spyOn(authApi, "refresh").mockRejectedValue(new AuthRefreshRejectedError());
    const onLost = jest.fn();
    setOnAuthLost(onLost);

    await expect(refreshAccess("stale")).rejects.toBeInstanceOf(AuthRefreshRejectedError);
    expect(mockClear).not.toHaveBeenCalled();
    expect(onLost).not.toHaveBeenCalled();
  });
});
