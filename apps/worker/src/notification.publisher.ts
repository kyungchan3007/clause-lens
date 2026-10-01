import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { analysisChannel } from "@clause-lens/db/analysis";
import type IORedis from "ioredis";

import { channelPrefix, createRedis } from "@clause-lens/infra";

// 상태 변경 발행 — worker가 문서 채널에 틱을 던지면 api가 구독해 SSE로 push.
// 페이로드는 최소(문서·버전)만. 실제 상태는 api가 DB에서 재조회(worker→DTO 결합 제거).
@Injectable()
export class NotificationPublisher implements OnModuleDestroy {
  private readonly pub: IORedis = createRedis();
  private readonly prefix = channelPrefix();

  async publish(documentId: string, stateVersion: number): Promise<void> {
    await this.pub.publish(
      analysisChannel(this.prefix, documentId),
      JSON.stringify({ documentId, stateVersion }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pub.quit();
  }
}
