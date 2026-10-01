import { Injectable } from "@nestjs/common";
import {
  confirmAnalysisResultTx,
  confirmPageAnalysisTx,
  isJobTerminal,
  isPageTerminal,
  upsertPageOcr,
  type ClauseInput,
  type OcrBlock,
  type PersistedOcr,
} from "@clause-lens/db/analysis";

import {
  loadConfig,
  NORMALIZATION_VERSION,
  OCR_ENGINE,
  ORIENTATION,
  PROMPT_VERSION,
  SCHEMA_VERSION,
  type WorkerConfig,
} from "./config";
import { AnalysisPermanentError, ValidationError, type WorkerErrorCode } from "./lib/errors";
import { mapClauses } from "./lib/box-mapper";
import { validateImage } from "./lib/image-validator";
import { NotificationPublisher } from "./notification.publisher";
import { ClauseAnalyzerPort } from "./ports/clause-analyzer.port";
import { OcrPermanentError, OcrPort, OcrTransientError } from "./ports/ocr.port";
import { StoragePort } from "./ports/storage.port";
import { PrismaService } from "./prisma.service";

// BullMQ Job의 최소 형태(테스트 용이성).
export interface AnalysisJobRef {
  data: { jobId: string };
  attemptsMade: number;
  opts: { attempts?: number };
}

interface FailDecision {
  retryLater: boolean; // true면 페이지 pending 유지 + job 재시도 신호
  errorCode: WorkerErrorCode; // @clause-lens/contracts 기반(+스텁 전용) — drift 차단(#131)
  retryable: boolean;
}

// 공통 processor: 페이지별 검증 → OCR(재사용/호출·저장) → 분석 → 매핑 → 결과 확정 → 알림.
@Injectable()
export class AnalysisProcessor {
  private readonly cfg: WorkerConfig = loadConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocr: OcrPort,
    private readonly analyzer: ClauseAnalyzerPort,
    private readonly storage: StoragePort,
    private readonly publisher: NotificationPublisher,
  ) {}

  async process(job: AnalysisJobRef): Promise<void> {
    const jobId = job.data.jobId;
    const analysisJob = await this.prisma.analysisJob.findUnique({
      where: { id: jobId },
      include: {
        pages: {
          include: {
            page: {
              select: { id: true, finalKey: true, revision: true, contentType: true },
            },
          },
        },
      },
    });
    if (!analysisJob) return; // 정리됨/없음
    if (isJobTerminal(analysisJob.status)) return; // 이미 종결(멱등)

    const maxAttempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;
    let mustRetry = false;

    for (const pa of analysisJob.pages) {
      if (isPageTerminal(pa.status)) continue; // 재실행 안전

      try {
        await this.processPage(jobId, analysisJob.documentId, pa);
      } catch (e) {
        const d = classify(e, isLastAttempt);
        if (d.retryLater) {
          mustRetry = true;
          continue; // 페이지 pending 유지 → job 재시도
        }
        const res = await confirmPageAnalysisTx(this.prisma, {
          jobId,
          outcome: {
            pageId: pa.pageId,
            ok: false,
            errorCode: d.errorCode,
            retryable: d.retryable,
          },
        });
        await this.publisher.publish(analysisJob.documentId, res.stateVersion);
      }
    }

    if (mustRetry) {
      // BullMQ 재시도(민감정보 없는 일반 메시지). 예산 소진 시 상위 failed 리스너가 종결.
      throw new Error("transient failures — retry job");
    }
  }

  private async processPage(
    jobId: string,
    documentId: string,
    pa: { pageId: string; revision: number; page: { finalKey: string | null; contentType: string } },
  ): Promise<void> {
    const { revision } = pa;
    const { finalKey, contentType } = pa.page;

    // 1. OCR 재사용(커밋된 승자 있으면 Vision 미호출).
    let ocr = await this.getExistingOcr(pa.pageId, revision, finalKey);
    if (!ocr) {
      if (!finalKey) throw new OcrPermanentError("ocr_failed"); // 업로드 확정 전(비정상)
      const bytes = await this.storage.getObject(finalKey, { maxBytes: this.cfg.imageMaxBytes });
      const validated = await validateImage(bytes, {
        declaredContentType: contentType,
        maxBytes: this.cfg.imageMaxBytes,
        maxPixels: this.cfg.imageMaxPixels,
        minPixels: this.cfg.imageMinPixels,
      });
      const { blocks } = await this.ocr.recognize({
        imageBytes: validated.uprightBytes,
        imageWidth: validated.width,
        imageHeight: validated.height,
      });
      // upsert는 저장된 승자 행을 반환 → 이후 분석은 승자 블록만 사용(R2-3).
      ocr = await upsertPageOcr(this.prisma, {
        pageId: pa.pageId,
        revision,
        engine: OCR_ENGINE,
        normalizationVersion: NORMALIZATION_VERSION,
        inputFingerprint: fingerprint(finalKey),
        orientation: ORIENTATION,
        imageWidth: validated.width,
        imageHeight: validated.height,
        blocks,
      });
    }

    // 2. 텍스트 미검출(판독 불가) → 정상 0건과 구분해 영구 실패로 종결.
    if (ocr.blocks.length === 0) throw new OcrPermanentError("ocr_failed");

    // 입력 상한(대용량 방어).
    const totalChars = ocr.blocks.reduce((a, b) => a + b.text.length, 0);
    if (
      ocr.blocks.length > this.cfg.analysisMaxInputBlocks ||
      totalChars > this.cfg.analysisMaxInputChars
    ) {
      throw new ValidationError("image_too_large");
    }

    // 3. 위험조항 분석(Claude).
    const analysis = await this.analyzer.analyze(
      ocr.blocks.map((b) => ({ id: b.id, text: b.text })),
    );

    // 4. blockId → box 매핑·검증(근거 전부 무효면 mapClauses가 analysis_failed throw).
    const clauses: ClauseInput[] = mapClauses(analysis.clauses, ocr.blocks);

    // 5. 결과 + done 원자 확정.
    const res = await confirmAnalysisResultTx(this.prisma, {
      jobId,
      input: {
        pageId: pa.pageId,
        revision,
        model: analysis.model,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        clauses,
      },
    });
    await this.publisher.publish(documentId, res.stateVersion);
  }

  private async getExistingOcr(
    pageId: string,
    revision: number,
    finalKey: string | null,
  ): Promise<PersistedOcr | null> {
    const row = await this.prisma.pageOcr.findUnique({
      where: { pageId_revision: { pageId, revision } },
    });
    if (!row) return null;
    // fingerprint 불일치(재배포로 normalizationVersion 변경 등) → 재분석 위해 새로 OCR.
    if (!finalKey || row.inputFingerprint !== fingerprint(finalKey)) return null;
    return {
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
      orientation: row.orientation,
      blocks: row.blocks as unknown as OcrBlock[],
    };
  }
}

function fingerprint(finalKey: string): string {
  return `${finalKey}|${NORMALIZATION_VERSION}`;
}

function classify(e: unknown, isLastAttempt: boolean): FailDecision {
  if (e instanceof ValidationError) {
    return { retryLater: false, errorCode: e.code, retryable: false };
  }
  if (e instanceof OcrPermanentError) {
    return { retryLater: false, errorCode: e.code, retryable: false };
  }
  if (e instanceof AnalysisPermanentError) {
    return { retryLater: false, errorCode: e.code, retryable: false };
  }
  if (e instanceof OcrTransientError) {
    return isLastAttempt
      ? { retryLater: false, errorCode: "ocr_timeout", retryable: true }
      : { retryLater: true, errorCode: "ocr_timeout", retryable: true };
  }
  const name = (e as { name?: string })?.name;
  if (name === "AnalysisTransientError") {
    return isLastAttempt
      ? { retryLater: false, errorCode: "analysis_timeout", retryable: true }
      : { retryLater: true, errorCode: "analysis_timeout", retryable: true };
  }
  // 알 수 없음(DB/Redis/네트워크 등) → transient 취급(재시도). 예산 소진 시 failed 리스너가 종결.
  return { retryLater: true, errorCode: "worker_failed", retryable: true };
}
