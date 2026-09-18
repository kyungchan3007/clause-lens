import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export interface AccessPayload {
  sub: string; // userId
  provider: string;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccessToken(userId: string, provider: string): Promise<string> {
    const payload: AccessPayload = { sub: userId, provider };
    return this.jwt.signAsync(payload);
  }

  verifyAccessToken(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token);
  }

  // 불투명 refresh 토큰: 원문은 클라이언트에만, DB엔 해시만 저장(회전·폐기 가능).
  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
