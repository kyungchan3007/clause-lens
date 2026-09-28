import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ANALYSIS_QUEUE } from "@clause-lens/db/analysis";
import { Queue } from "bullmq";
import type IORedis from "ioredis";

import { QueuePort } from "../ports/queue.port";
import { createRedis } from "./redis.config";

// BullMQ 기반 producer. jobId를 큐 job id로 사용 → 동일 job 중복 add를 큐가 멱등 처리.
@Injectable()
export class BullmqQueueAdapter extends QueuePort implements OnModuleDestroy {
  private readonly connection: IORedis = createRedis();
  private readonly queue = new Queue(ANALYSIS_QUEUE, {
    connection: this.connection,
  });

  async enqueueAnalysis(jobId: string): Promise<void> {
    await this.queue.add(
      "analyze",
      { jobId },
      {
        jobId, // 멱등: 같은 jobId 재등록은 무시
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
