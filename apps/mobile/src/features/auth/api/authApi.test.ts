import { AuthRefreshRejectedError, fetchMe, loginWithKakao, logout, refresh } from "./authApi";

// EXPO_PUBLIC_API_BASE_URL은 jest.setup.js에서 http://localhost:3000으로 설정됨.
const BASE = "http://localhost:3000";

describe("authApi", () => {
  afterEach(() => jest.restoreAllMocks());

  it("loginWithKakao는 accessToken을 POST하고 AuthResult 반환", async () => {
    const result = {
      accessToken: "a",
      refreshToken: "r",
      user: { id: "u1", provider: "KAKAO", email: null, displayName: "박경찬" },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => result,
    }) as unknown as typeof fetch;

    await expect(loginWithKakao("kakao-token")).resolves.toEqual(result);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/auth/kakao`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ accessToken: "kakao-token" }),
      }),
    );
  });

  it("loginWithKakao는 non-ok 응답에서 에러", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(loginWithKakao("bad")).rejects.toThrow(/401/);
  });

  it("fetchMe는 Bearer 토큰으로 조회하고 user 반환", async () => {
    const user = { id: "u1", provider: "KAKAO", email: null, displayName: "박경찬" };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => user,
    }) as unknown as typeof fetch;

    await expect(fetchMe("access")).resolves.toEqual(user);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/auth/me`,
      expect.objectContaining({ headers: { Authorization: "Bearer access" } }),
    );
  });

  it("fetchMe는 non-ok에서 에러(세션 검증 실패)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(fetchMe("x")).rejects.toThrow();
  });

  it("logout은 refreshToken을 POST", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    await logout("r");
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/auth/logout`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ refreshToken: "r" }) }),
    );
  });

  it("logout은 네트워크 실패를 삼킨다(로컬 정리는 별도 보장)", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    await expect(logout("r")).resolves.toBeUndefined();
  });

  // #126 — refresh 에러 분류(확정 실패 vs 일시 장애)
  it("refresh는 refreshToken을 POST하고 AuthResult 반환", async () => {
    const result = {
      accessToken: "a2",
      refreshToken: "r2",
      user: { id: "u1", provider: "KAKAO", email: null, displayName: "박경찬" },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => result,
    }) as unknown as typeof fetch;

    await expect(refresh("r")).resolves.toEqual(result);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/auth/refresh`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ refreshToken: "r" }) }),
    );
  });

  it("refresh는 401/403에서 AuthRefreshRejectedError(확정 거부)", async () => {
    for (const status of [401, 403]) {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status }) as unknown as typeof fetch;
      await expect(refresh("r")).rejects.toBeInstanceOf(AuthRefreshRejectedError);
    }
  });

  it("refresh는 5xx에서 일반 에러(일시 장애 — 세션 유지 대상)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    const err = await refresh("r").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AuthRefreshRejectedError);
  });
});
