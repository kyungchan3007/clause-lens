import { Module } from "@nestjs/common";

import { BullmqQueueAdapter } from "../../adapters/bullmq-queue.adapter";
import { MinioStorageAdapter } from "../../adapters/minio-storage.adapter";
import { RedisNotificationAdapter } from "../../adapters/redis-notification.adapter";
import { AnalysisNotificationPort } from "../../ports/analysis-notification.port";
import { QueuePort } from "../../ports/queue.port";
import { StoragePort } from "../../ports/storage.port";
import { AuthModule } from "../auth/auth.module";
import { DocumentsModule } from "../documents/documents.module";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";

@Module({
  imports: [AuthModule, DocumentsModule], // AuthModule: JwtAuthGuard, DocumentsModule: 상태 소유
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    { provide: QueuePort, useClass: BullmqQueueAdapter },
    { provide: AnalysisNotificationPort, useClass: RedisNotificationAdapter },
    { provide: StoragePort, useClass: MinioStorageAdapter }, // 정규화 이미지 presign(#175)
  ],
})
export class AnalysisModule {}
