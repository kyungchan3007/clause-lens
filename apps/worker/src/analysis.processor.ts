import { Injectable } from "@nestjs/common";
import { confirmPageAnalysisTx, type PageOutcome } from "@clause-lens/db/analysis";

import { NotificationPublisher } from "./notification.publisher";
import { OcrPermanentError, OcrPort } from "./ports/ocr.port";
import { PrismaService } from "./prisma.service";

// BullMQ Job에서 필요한 최소 형태(테스트 용이성).
export interface AnalysisJobRef {
  data: { jobId: string };
  attemptsMade: number;
  opts: { attempts?: number };
}

const TERMINAL = new Set(["done", "partial", "failed"]);

// 공통 processor: 입력 조회 → OcrPort → 결과 확정(공유 tx) → 알림.
// 실제 Vision 연동 시 OcrPort 어댑터만 교체(경로·재시도·확정 구조는 그대로).
@Injectable()
export class AnalysisProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ocr: OcrPort,
    private readonly publisher: NotificationPublisher,
  ) {}

  async process(job: AnalysisJobRef): Promise<void> {
    const jobId = job.data.jobId;
    const analysisJob = await this.prisma.analysisJob.findUnique({
      where: { id: jobId },
      include: {
        pages: { include: { page: { select: { id: true, finalKey: true } } } },
      },
    });
    if (!analysisJob) return; // 정리됨/없어진 job → skip
    if (TERMINAL.has(analysisJob.status)) return; // 이미 종결(멱등)

    const maxAttempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;
    let mustRetry = false;

    for (const pa of analysisJob.pages) {
      // 완료 페이지 건너뛰기(재실행 안전 + 커밋된 성공 페이지 재호출 방지).
      if (pa.status === "done" || pa.status === "failed") continue;

      let outcome: PageOutcome | null = null;
      try {
        await this.ocr.analyzePage({
          pageId: pa.pageId,
          finalKey: pa.page.finalKey ?? "",
          revision: pa.revision,
        });
        outcome = { pageId: pa.pageId, ok: true };
      } catch (e) {
        if (e instanceof OcrPermanentError) {
          outcome = {
            pageId: pa.pageId,
            ok: false,
            errorCode: e.code,
            retryable: false,
          };
        } else if (isLastAttempt) {
          // 자동 재시도 예산 소진 → 사용자 재시도 가능으로 종결(예산≠retryable 분리).
          outcome = {
            pageId: pa.pageId,
            ok: false,
            errorCode: "ocr_timeout",
            retryable: true,
          };
        } else {
          // 일시 오류 & 예산 남음 → 페이지 pending 유지, job 재시도로 재처리.
          mustRetry = true;
        }
      }

      if (outcome) {
        const res = await confirmPageAnalysisTx(this.prisma, { jobId, outcome });
        await this.publisher.publish(analysisJob.documentId, res.stateVersion);
      }
    }

    if (mustRetry) {
      // BullMQ가 재시도하도록 실패 신호(민감정보 없는 일반 메시지).
      throw new Error("transient OCR failures — retry job");
    }
  }
}
