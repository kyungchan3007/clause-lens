import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import type { AuthUser } from "../decorators/current-user.decorator";
import { TokenService } from "../token/token.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      throw new UnauthorizedException("인증 토큰이 없습니다.");
    }
    try {
      const payload = await this.tokens.verifyAccessToken(token);
      req.user = { userId: payload.sub, provider: payload.provider };
      return true;
    } catch {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }
  }
}
