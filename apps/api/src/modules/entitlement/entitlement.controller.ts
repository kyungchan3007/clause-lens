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
}
