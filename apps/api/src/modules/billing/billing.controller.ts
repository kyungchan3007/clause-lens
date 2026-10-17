import { Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { CurrentUser, type AuthUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BillingIdentifyService } from "./billing-identify.service";

// 결제 계정 연결(#165 Slice 4A). 인증 필요. 멱등이라 로그인 시 1회 + 구매 후 재확인(4B)에 재사용.
@Controller("me/billing")
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly identifyService: BillingIdentifyService) {}

  @Post("identify")
  @HttpCode(200)
  identify(@CurrentUser() user: AuthUser) {
    return this.identifyService.identify(user.userId, new Date());
  }
}
