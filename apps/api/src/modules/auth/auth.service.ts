import { Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service";
import { KakaoVerifier } from "./adapters/kakao.verifier";
import { TokenService } from "./token/token.service";

const REFRESH_TTL_DAYS = 30;

interface SessionUser {
  id: string;
  provider: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kakao: KakaoVerifier,
    private readonly tokens: TokenService,
  ) {}

  async loginWithKakao(accessToken: string): Promise<AuthResult> {
    const profile = await this.kakao.verify(accessToken);
    const user = await this.prisma.user.upsert({
      where: {
        provider_providerUserId: {
          provider: "KAKAO",
          providerUserId: profile.providerUserId,
        },
      },
      update: {
        email: profile.email ?? null,
        displayName: profile.displayName ?? null,
      },
      create: {
        provider: "KAKAO",
        providerUserId: profile.providerUserId,
        email: profile.email ?? null,
        displayName: profile.displayName ?? null,
      },
    });
    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!existing || existing.revokedAt !== null || existing.expiresAt < new Date()) {
      throw new UnauthorizedException("유효하지 않은 refresh 토큰입니다.");
    }
    // 회전: 사용한 refresh는 즉시 폐기하고 새 세션을 발급.
    await this.prisma.refreshToken.delete({ where: { id: existing.id } });
    return this.issueSession(existing.user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  private async issueSession(user: SessionUser): Promise<AuthResult> {
    const accessToken = await this.tokens.signAccessToken(user.id, user.provider);
    const { token: refreshToken, hash } = this.tokens.generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        provider: user.provider,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }
}
