import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { KakaoVerifier } from "./adapters/kakao.verifier";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { TokenService } from "./token/token.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        // 초 단위(number) — 기본 900s(15분).
        signOptions: { expiresIn: Number(config.get<string>("ACCESS_TOKEN_TTL_SECONDS") ?? "900") },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, KakaoVerifier, JwtAuthGuard],
})
export class AuthModule {}
