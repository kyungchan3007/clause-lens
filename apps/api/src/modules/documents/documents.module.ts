import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DocumentsListController } from "./documents-list.controller";
import { DocumentsRepository } from "./documents.repository";
import { DocumentsService } from "./documents.service";

// Document/Page 상태의 소유 도메인. 공개 서비스만 export.
// 재열람 목록(#96)은 /me/documents 컨트롤러로 노출 — JwtAuthGuard는 AuthModule 제공자에 의존.
@Module({
  imports: [AuthModule],
  controllers: [DocumentsListController],
  providers: [DocumentsService, DocumentsRepository],
  exports: [DocumentsService],
})
export class DocumentsModule {}
