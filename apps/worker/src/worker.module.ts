import { Module } from "@nestjs/common";

import { StubOcrAdapter } from "./adapters/stub-ocr.adapter";
import { AnalysisProcessor } from "./analysis.processor";
import { NotificationPublisher } from "./notification.publisher";
import { OcrPort } from "./ports/ocr.port";
import { PrismaService } from "./prisma.service";

// worker DI 배선. 실제 Vision 전환 시 OcrPort provider만 VisionOcrAdapter로 교체.
@Module({
  providers: [
    AnalysisProcessor,
    NotificationPublisher,
    PrismaService,
    { provide: OcrPort, useClass: StubOcrAdapter },
  ],
})
export class WorkerModule {}
