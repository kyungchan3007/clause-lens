import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service";
import { AuthService } from "./auth.service";
import { CurrentUser, type AuthUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // 앱이 카카오 SDK로 받은 access token으로 로그인 → 우리 JWT 세션 발급
  @Post("kakao")
  @HttpCode(200)
  kakao(@Body() body: { accessToken?: string }) {
    if (!body?.accessToken) {
      throw new UnauthorizedException("accessToken이 필요합니다.");
    }
    return this.auth.loginWithKakao(body.accessToken);
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body() body: { refreshToken?: string }) {
    if (!body?.refreshToken) {
      throw new UnauthorizedException("refreshToken이 필요합니다.");
    }
    return this.auth.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() body: { refreshToken?: string }): Promise<void> {
    if (body?.refreshToken) {
      await this.auth.logout(body.refreshToken);
    }
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id: current.userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      provider: user.provider,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
