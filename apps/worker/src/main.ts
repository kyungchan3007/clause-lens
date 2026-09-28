import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { ANALYSIS_QUEUE } from "@clause-lens/db/analysis";
import { Worker, type Job } from "bullmq";

import { AnalysisProcessor } from "./analysis.processor";
import { createRedis } from "./redis.config";
import { WorkerModule } from "./worker.module";

// OCR Worker — NestJS standalone(HTTP 없음) + BullMQ consumer.
// 흐름: api가 analysis job을 큐에 넣음 → 여기서 꺼내 processor 실행 → 결과 DB 확정 + 알림.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const processor = app.get(AnalysisProcessor);
  const connection = createRedis();

  const worker = new Worker<{ jobId: string }>(
    ANALYSIS_QUEUE,
    (job: Job<{ jobId: string }>) => processor.process(job),
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
    },
  );

  // 실패는 BullMQ가 재시도/격리. 민감정보(이미지·토큰·OCR 텍스트) 로그 금지.
  worker.on("error", () => {});

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await connection.quit();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void bootstrap();
