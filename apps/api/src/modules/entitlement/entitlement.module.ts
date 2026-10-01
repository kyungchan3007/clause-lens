import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { EntitlementController } from "./entitlement.controller";
import { EntitlementService } from "./entitlement.service";

// 자격(무료 분석 횟수) 조회. JwtAuthGuard는 AuthModule 제공자에 의존.
@Module({
  imports: [AuthModule],
  controllers: [EntitlementController],
  providers: [EntitlementService],
})
export class EntitlementModule {}
