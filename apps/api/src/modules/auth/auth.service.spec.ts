import { UnauthorizedException } from "@nestjs/common";

import { AuthService } from "./auth.service";

// prisma·verifier·tokens를 목으로 대체하고 AuthService 로직만 검증.
function makeDeps() {
  const prisma = {
    user: { upsert: jest.fn() },
    refreshToken: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const kakao = { verify: jest.fn() };
  const tokens = {
    signAccessToken: jest.fn().mockResolvedValue("access-jwt"),
    generateRefreshToken: jest
      .fn()
      .mockReturnValue({ token: "refresh-raw", hash: "refresh-hash" }),
    hashRefreshToken: jest.fn((t: string) => `hash(${t})`),
  };
  // 실제 생성자 시그니처: (prisma, kakao, tokens)
  const service = new AuthService(prisma as any, kakao as any, tokens as any);
  return { service, prisma, kakao, tokens };
}

describe("AuthService", () => {
  describe("loginWithKakao", () => {
    it("카카오 재검증 → user upsert → 세션 발급", async () => {
      const { service, prisma, kakao, tokens } = makeDeps();
      kakao.verify.mockResolvedValue({
        provider: "KAKAO",
        providerUserId: "123",
        email: "a@b.com",
        displayName: "박경찬",
      });
      prisma.user.upsert.mockResolvedValue({
        id: "u1",
        provider: "KAKAO",
        email: "a@b.com",
        displayName: "박경찬",
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.loginWithKakao("kakao-access");

      expect(kakao.verify).toHaveBeenCalledWith("kakao-access");
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            provider_providerUserId: { provider: "KAKAO", providerUserId: "123" },
          },
        }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "u1", tokenHash: "refresh-hash" }),
        }),
      );
      expect(result).toEqual({
        accessToken: "access-jwt",
        refreshToken: "refresh-raw",
        user: { id: "u1", provider: "KAKAO", email: "a@b.com", displayName: "박경찬" },
      });
      expect(tokens.signAccessToken).toHaveBeenCalledWith("u1", "KAKAO");
    });
  });

  describe("refresh", () => {
    it("회전: 사용한 토큰 삭제 후 새 세션 발급", async () => {
      const { service, prisma } = makeDeps();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
        user: { id: "u1", provider: "KAKAO", email: null, displayName: null },
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh("refresh-raw");

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: "rt1" } });
      expect(result.accessToken).toBe("access-jwt");
      expect(result.user.id).toBe("u1");
    });

    it("존재하지 않는 refresh → 401", async () => {
      const { service, prisma } = makeDeps();
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh("x")).rejects.toThrow(UnauthorizedException);
    });

    it("폐기된(revoked) refresh → 401", async () => {
      const { service, prisma } = makeDeps();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100_000),
        user: {},
      });
      await expect(service.refresh("x")).rejects.toThrow(UnauthorizedException);
    });

    it("만료된 refresh → 401", async () => {
      const { service, prisma } = makeDeps();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt",
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1_000),
        user: {},
      });
      await expect(service.refresh("x")).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("해시로 refresh 토큰 삭제", async () => {
      const { service, prisma, tokens } = makeDeps();
      await service.logout("refresh-raw");
      expect(tokens.hashRefreshToken).toHaveBeenCalledWith("refresh-raw");
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: "hash(refresh-raw)" },
      });
    });
  });
});
