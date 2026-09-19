import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";

import { JwtAuthGuard } from "./jwt-auth.guard";

// 최소 ExecutionContext 목: switchToHttp().getRequest()만 사용됨.
function contextWith(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  it("유효한 Bearer 토큰이면 통과하고 req.user 주입", async () => {
    const tokens = {
      verifyAccessToken: jest.fn().mockResolvedValue({ sub: "u1", provider: "KAKAO" }),
    };
    const guard = new JwtAuthGuard(tokens as any);
    const req: { headers: Record<string, string>; user?: unknown } = {
      headers: { authorization: "Bearer good" },
    };

    await expect(guard.canActivate(contextWith(req))).resolves.toBe(true);
    expect(req.user).toEqual({ userId: "u1", provider: "KAKAO" });
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith("good");
  });

  it("Authorization 헤더가 없으면 401", async () => {
    const guard = new JwtAuthGuard({ verifyAccessToken: jest.fn() } as any);
    await expect(guard.canActivate(contextWith({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("Bearer 접두어가 아니면 401", async () => {
    const guard = new JwtAuthGuard({ verifyAccessToken: jest.fn() } as any);
    await expect(
      guard.canActivate(contextWith({ headers: { authorization: "good" } })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("토큰 검증 실패면 401", async () => {
    const tokens = {
      verifyAccessToken: jest.fn().mockRejectedValue(new Error("bad")),
    };
    const guard = new JwtAuthGuard(tokens as any);
    await expect(
      guard.canActivate(contextWith({ headers: { authorization: "Bearer bad" } })),
    ).rejects.toThrow(UnauthorizedException);
  });
});
