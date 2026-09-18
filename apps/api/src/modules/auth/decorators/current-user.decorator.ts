import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  userId: string;
  provider: string;
}

// JwtAuthGuard가 req.user에 심은 현재 사용자를 주입.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return req.user;
  },
);
