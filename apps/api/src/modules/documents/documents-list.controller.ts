import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { DocumentListResponse } from "@clause-lens/contracts";

import { CurrentUser, type AuthUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DocumentsService } from "./documents.service";

// 재열람 가능한 최근 분석 문서 목록(#96 / 0030). entitlement와 같은 /me prefix(별도 컨트롤러).
@Controller("me")
@UseGuards(JwtAuthGuard)
export class DocumentsListController {
  constructor(private readonly documents: DocumentsService) {}

  // GET /me/documents?cursor=&limit= — 완료순 커서 페이지네이션. limit 상한은 서버가 강제.
  @Get("documents")
  listMine(
    @CurrentUser() user: AuthUser,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<DocumentListResponse> {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.documents.listRecentDocuments(user.userId, {
      cursor,
      limit: Number.isFinite(parsed) ? parsed : undefined,
    });
  }
}
