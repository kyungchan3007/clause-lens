import { UnauthorizedException } from "@nestjs/common";

import { KakaoVerifier } from "./kakao.verifier";

describe("KakaoVerifier", () => {
  const verifier = new KakaoVerifier();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("/v2/user/me 응답에서 프로필 추출", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 123,
        kakao_account: { email: "a@b.com", profile: { nickname: "박경찬" } },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const profile = await verifier.verify("kakao-access");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://kapi.kakao.com/v2/user/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer kakao-access" },
      }),
    );
    expect(profile).toEqual({
      provider: "KAKAO",
      providerUserId: "123",
      email: "a@b.com",
      displayName: "박경찬",
    });
  });

  it("응답이 ok가 아니면 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(verifier.verify("bad")).rejects.toThrow(UnauthorizedException);
  });

  it("id가 없으면 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    await expect(verifier.verify("t")).rejects.toThrow(UnauthorizedException);
  });

  it("이메일·닉네임이 없어도 providerUserId만으로 성공", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 999 }),
    }) as unknown as typeof fetch;
    const profile = await verifier.verify("t");
    expect(profile.providerUserId).toBe("999");
    expect(profile.email).toBeUndefined();
    expect(profile.displayName).toBeUndefined();
  });
});
