import { Module } from "@nestjs/common";

import { MinioStorageAdapter } from "../../adapters/minio-storage.adapter";
import { StoragePort } from "../../ports/storage.port";
import { AuthModule } from "../auth/auth.module";
import { DocumentsModule } from "../documents/documents.module";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  imports: [AuthModule, DocumentsModule], // AuthModule: JwtAuthGuard
  controllers: [UploadsController],
  providers: [
    UploadsService,
    { provide: StoragePort, useClass: MinioStorageAdapter },
  ],
})
export class UploadsModule {}
