import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import {
  normalizedImageKey,
  type AnalysisStatusResponse,
} from "@clause-lens/contracts";

import { QueuePort } from "../../ports/queue.port";
import { StoragePort } from "../../ports/storage.port";
import { DocumentsService } from "../documents/documents.service";
import { toStatusResponse } from "./analysis.mapper";

// 접수 후 이 시간이 지나도 미전달(dispatchedAt null)이면 reconciler가 재전달.
const DISPATCH_GRACE_MS = 30_000;
const RECONCILE_INTERVAL_MS = 30_000;
// 정규화 이미지 presigned GET 유효기간(#175). 결과 조회 즉시 로드 → 짧게.
const NORMALIZED_IMAGE_TTL_S = 3600;

// 분석 접수 조율 + 상태 조회 + 미전달 복구(좁은 reconciler).
// 상태 소유·전이는 DocumentsService/packages-db가 담당. 여기선 큐 등록·복구만.
@Injectable()
export class AnalysisService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly documents: DocumentsService,
    private readonly queue: QueuePort,
    private readonly storage: StoragePort,
  ) {}

  // 완료 페이지(정규화 치수 존재)에 서버 정규화 이미지 presigned GET URL을 붙인다(#175).
  // 보관 만료(410)는 getAnalysis가 선차단하므로 여기 도달 = 접근 허용 상태.
  private async attachNormalizedImages(
    resp: AnalysisStatusResponse,
  ): Promise<AnalysisStatusResponse> {
    const pages = await Promise.all(
      resp.pages.map(async (p) => {
        if (!p.imageWidth || !p.imageHeight) return p;
        const url = await this.storage.presignGet(
          normalizedImageKey(resp.documentId, p.pageId, p.revision),
          NORMALIZED_IMAGE_TTL_S,
        );
        return {
          ...p,
          normalizedImage: {
            url,
            width: p.imageWidth,
            height: p.imageHeight,
            revision: p.revision,
          },
        };
      }),
    );
    return { ...resp, pages };
  }

  // 분석 요청(멱등): 접수(같은 문서=같은 job) → 미전달이면 enqueue+전달기록.
  async analyze(
    userId: string,
    documentId: string,
  ): Promise<AnalysisStatusResponse> {
    const job = await this.documents.startAnalysis(userId, documentId);
    if (!job.dispatchedAt) {
      await this.queue.enqueueAnalysis(job.id); // 큐 job id=job.id → 중복 add 멱등
      await this.documents.markDispatched(job.id);
    }
    return this.attachNormalizedImages(toStatusResponse(job));
  }

  // 진실의 기준(재진입·재연결 fallback).
  async getStatus(
    userId: string,
    documentId: string,
  ): Promise<AnalysisStatusResponse> {
    const job = await this.documents.getAnalysis(userId, documentId);
    return this.attachNormalizedImages(toStatusResponse(job));
  }

  // enqueue 누락 복구: DB 커밋됐지만 큐에 못 올라간 활성 job을 재전달.
  async recoverUndispatched(): Promise<number> {
    const before = new Date(Date.now() - DISPATCH_GRACE_MS);
    const ids = await this.documents.findUndispatchedActiveJobIds(before);
    for (const id of ids) {
      await this.queue.enqueueAnalysis(id);
      await this.documents.markDispatched(id);
    }
    return ids.length;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.recoverUndispatched().catch(() => {
        // 복구 실패는 다음 주기에 재시도(로그 없이 무시 — 민감정보 로그 금지 원칙).
      });
    }, RECONCILE_INTERVAL_MS);
    // 이벤트 루프를 붙잡지 않도록(테스트·종료 대비).
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
