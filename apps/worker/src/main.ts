import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { ANALYSIS_QUEUE } from "@clause-lens/db/analysis";
import { Queue, Worker, type Job } from "bullmq";

import { AnalysisProcessor } from "./analysis.processor";
import { assertBootConfig } from "./config";
import { terminalizeStuckJob } from "./lib/terminalize";
import { NotificationPublisher } from "./notification.publisher";
import { PrismaService } from "./prisma.service";
import { createRedis } from "@clause-lens/infra";
import { WorkerModule } from "./worker.module";

// OCR Worker — NestJS standalone(HTTP 없음) + BullMQ consumer.
// 흐름: api가 analysis job을 큐에 넣음 → 꺼내 processor 실행 → 결과 DB 확정 + 알림.
async function bootstrap(): Promise<void> {
  assertBootConfig(); // production 필수 크레덴셜 검증(누락 시 부팅 실패)

  const app = await NestFactory.createApplicationContext(WorkerModule);
  const processor = app.get(AnalysisProcessor);
  const prisma = app.get(PrismaService);
  const publisher = app.get(NotificationPublisher);
  const connection = createRedis();

  const worker = new Worker<{ jobId: string }>(
    ANALYSIS_QUEUE,
    (job: Job<{ jobId: string }>) => processor.process(job),
    { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) },
  );

  // 민감정보(이미지·토큰·OCR/조항 텍스트) 로그 금지.
  worker.on("error", () => {});
  // 잡 최종 실패 → 미종결 페이지 종결(processing 갇힘 방지, 0021 §⑤).
  worker.on("failed", (job) => {
    const jobId = job?.data?.jobId;
    if (jobId) void terminalizeStuckJob(prisma, publisher, jobId).catch(() => {});
  });

  // 큐 terminal ↔ DB active 불일치 reconciler(리스너 누락·크래시 보완, 0021 R2-2).
  const queue = new Queue(ANALYSIS_QUEUE, { connection: createRedis() });
  const reconcileIntervalMs = Number(process.env.RECONCILE_INTERVAL_MS ?? 60_000);
  const reconcile = async (): Promise<void> => {
    try {
      const active = await prisma.analysisJob.findMany({
        where: { status: { in: ["queued", "processing"] }, dispatchedAt: { not: null } },
        select: { id: true, updatedAt: true },
      });
      const now = Date.now();
      for (const j of active) {
        if (now - new Date(j.updatedAt).getTime() < reconcileIntervalMs) continue;
        const bj = await queue.getJob(j.id);
        const state = bj ? await bj.getState() : "missing";
        if (state === "failed" || state === "missing") {
          await terminalizeStuckJob(prisma, publisher, j.id);
        }
      }
    } catch {
      /* 로그 금지 */
    }
  };
  const timer = setInterval(() => void reconcile(), reconcileIntervalMs);
  timer.unref?.();

  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
    await worker.close();
    await queue.close();
    await connection.quit();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void bootstrap();
