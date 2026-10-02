import { Controller, Get, UseGuards } from "@nestjs/common";

import { CurrentUser, type AuthUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { EntitlementService } from "./entitlement.service";

@Controller("me")
@UseGuards(JwtAuthGuard)
export class EntitlementController {
  constructor(private readonly entitlement: EntitlementService) {}

  // 현재 사용자의 무료 분석 잔량(서버 값). 앱 표시용.
  @Get("entitlement")
  getMine(@CurrentUser() user: AuthUser) {
    return this.entitlement.getMine(user.userId);
  }

  // 접근 권한(보관 가능·분석 잔여) — 구독이면 월 쿼터, 아니면 무료(#162).
  @Get("access")
  getAccess(@CurrentUser() user: AuthUser) {
    return this.entitlement.getAccess(user.userId);
  }
}
