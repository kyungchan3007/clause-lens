import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { DocumentListResponse, SaveDocumentResponse } from "@clause-lens/contracts";

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

  // POST /me/documents/:id/save — 분석 결과 장기 보관 전환(#163, 멱등).
  // 거부: 404(미소유)·403(미구독)·410(만료)·409(미완료). 서버 canSaveDocuments가 보안 경계(앱 플래그는 UI 전용).
  @Post("documents/:id/save")
  @HttpCode(200)
  save(
    @CurrentUser() user: AuthUser,
    @Param("id") documentId: string,
  ): Promise<SaveDocumentResponse> {
    return this.documents.saveDocument(user.userId, documentId);
  }
}
