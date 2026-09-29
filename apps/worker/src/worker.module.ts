import { Module } from "@nestjs/common";

import { ClaudeClauseAnalyzer } from "./adapters/claude-clause-analyzer.adapter";
import { S3StorageAdapter } from "./adapters/s3-storage.adapter";
import { StubClauseAnalyzer } from "./adapters/stub-clause-analyzer.adapter";
import { StubOcrAdapter } from "./adapters/stub-ocr.adapter";
import { VisionOcrAdapter } from "./adapters/vision-ocr.adapter";
import { AnalysisProcessor } from "./analysis.processor";
import { hasAnthropicKey, hasVisionCreds } from "./config";
import { NotificationPublisher } from "./notification.publisher";
import { ClauseAnalyzerPort } from "./ports/clause-analyzer.port";
import { OcrPort } from "./ports/ocr.port";
import { StoragePort } from "./ports/storage.port";
import { PrismaService } from "./prisma.service";

// worker DI 배선. 크레덴셜 있으면 실 어댑터, 없으면 stub(개발). production 필수 검증은 main의 assertBootConfig.
@Module({
  providers: [
    AnalysisProcessor,
    NotificationPublisher,
    PrismaService,
    { provide: StoragePort, useClass: S3StorageAdapter },
    { provide: OcrPort, useClass: hasVisionCreds() ? VisionOcrAdapter : StubOcrAdapter },
    {
      provide: ClauseAnalyzerPort,
      useClass: hasAnthropicKey() ? ClaudeClauseAnalyzer : StubClauseAnalyzer,
    },
  ],
})
export class WorkerModule {}
