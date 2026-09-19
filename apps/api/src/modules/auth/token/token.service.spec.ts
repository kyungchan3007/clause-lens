import { JwtService } from "@nestjs/jwt";

import { TokenService } from "./token.service";

describe("TokenService", () => {
  const jwt = new JwtService({
    secret: "test-secret",
    signOptions: { expiresIn: 900 },
  });
  const service = new TokenService(jwt);

  it("access token 서명→검증 왕복 시 payload 보존", async () => {
    const token = await service.signAccessToken("user-1", "KAKAO");
    const payload = await service.verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.provider).toBe("KAKAO");
  });

  it("위조/잘못된 토큰은 검증 실패", async () => {
    await expect(service.verifyAccessToken("not-a-jwt")).rejects.toBeDefined();
  });

  it("generateRefreshToken은 base64url 토큰 + 일치하는 sha256 해시 반환", () => {
    const { token, hash } = service.generateRefreshToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    expect(hash).toHaveLength(64); // sha256 hex
    expect(service.hashRefreshToken(token)).toBe(hash);
  });

  it("hashRefreshToken은 결정적이며 입력별로 다름", () => {
    expect(service.hashRefreshToken("a")).toBe(service.hashRefreshToken("a"));
    expect(service.hashRefreshToken("a")).not.toBe(service.hashRefreshToken("b"));
  });

  it("생성되는 refresh 토큰은 매번 유일", () => {
    const a = service.generateRefreshToken();
    const b = service.generateRefreshToken();
    expect(a.token).not.toBe(b.token);
  });
});
