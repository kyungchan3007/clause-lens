import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import type IORedis from "ioredis";

import { AnalysisNotificationPort } from "../ports/analysis-notification.port";
import { channelPrefix, createRedis } from "@clause-lens/infra";

interface Entry {
  subject: Subject<void>;
  count: number;
}

// Redis Pub/Sub 구독 → 문서별 로컬 Subject로 fan-out. 다중 api 인스턴스 라우팅 해결.
// 단일 구독 연결(psubscribe) + 문서별 refcount로 마지막 구독 해제 시 정리.
@Injectable()
export class RedisNotificationAdapter
  extends AnalysisNotificationPort
  implements OnModuleInit, OnModuleDestroy
{
  private readonly sub: IORedis = createRedis();
  private readonly prefix = channelPrefix();
  private readonly entries = new Map<string, Entry>();

  async onModuleInit(): Promise<void> {
    await this.sub.psubscribe(`${this.prefix}:analysis:*`);
    this.sub.on("pmessage", (_pattern, channel) => {
      // 채널 = `${prefix}:analysis:${documentId}`
      const documentId = channel.slice(channel.lastIndexOf(":") + 1);
      this.entries.get(documentId)?.subject.next();
    });
  }

  watch(documentId: string): Observable<void> {
    return new Observable<void>((subscriber) => {
      let entry = this.entries.get(documentId);
      if (!entry) {
        entry = { subject: new Subject<void>(), count: 0 };
        this.entries.set(documentId, entry);
      }
      entry.count += 1;
      const inner = entry.subject.subscribe(subscriber);
      return () => {
        inner.unsubscribe();
        const e = this.entries.get(documentId);
        if (!e) return;
        e.count -= 1;
        if (e.count <= 0) {
          e.subject.complete();
          this.entries.delete(documentId);
        }
      };
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.sub.quit();
  }
}
