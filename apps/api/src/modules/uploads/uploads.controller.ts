import { Body, Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import {
  completeRequestSchema,
  presignRequestSchema,
  reprisignRequestSchema,
  type CompleteRequest,
  type PresignRequest,
  type ReprisignRequest,
} from "@clause-lens/contracts";

import { ZodBody } from "../../common/zod-body.pipe";
import { CurrentUser, type AuthUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  // 세션 생성(멱등) + 임시키 presigned PUT URL 발급(배치)
  @Post("presign")
  @HttpCode(200)
  presign(
    @CurrentUser() user: AuthUser,
    @Body(new ZodBody(presignRequestSchema)) body: PresignRequest,
  ) {
    return this.uploads.presign(user.userId, body);
  }

  // 미확정 페이지 URL 재발급(만료·실패 복구)
  @Post(":documentId/reprisign")
  @HttpCode(200)
  reprisign(
    @CurrentUser() user: AuthUser,
    @Param("documentId") documentId: string,
    @Body(new ZodBody(reprisignRequestSchema)) body: ReprisignRequest,
  ) {
    return this.uploads.reprisign(user.userId, documentId, body.pageIds);
  }

  // 업로드 확정(검증·copy·원자 확정)
  @Post(":documentId/complete")
  @HttpCode(200)
  complete(
    @CurrentUser() user: AuthUser,
    @Param("documentId") documentId: string,
    @Body(new ZodBody(completeRequestSchema)) body: CompleteRequest,
  ) {
    return this.uploads.complete(user.userId, documentId, body.pageIds);
  }
}
