import { Module } from "@nestjs/common";

import { DocumentsRepository } from "./documents.repository";
import { DocumentsService } from "./documents.service";

// Document/Page 상태의 소유 도메인. 공개 서비스만 export.
@Module({
  providers: [DocumentsService, DocumentsRepository],
  exports: [DocumentsService],
})
export class DocumentsModule {}
