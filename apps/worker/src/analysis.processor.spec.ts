import {
  confirmAnalysisResultTx,
  confirmPageAnalysisTx,
  upsertPageOcr,
} from "@clause-lens/db/analysis";

import { AnalysisProcessor, type AnalysisJobRef } from "./analysis.processor";
import { NORMALIZATION_VERSION } from "./config";
import { AnalysisPermanentError, AnalysisTransientError, ValidationError } from "./lib/errors";
import { mapClauses } from "./lib/box-mapper";
import { validateImage } from "./lib/image-validator";
import type { NotificationPublisher } from "./notification.publisher";
import type { ClauseAnalyzerPort } from "./ports/clause-analyzer.port";
import { OcrPermanentError, type OcrPort } from "./ports/ocr.port";
import type { StoragePort } from "./ports/storage.port";
import type { PrismaService } from "./prisma.service";

// Tx 함수만 모킹하고, 순수 종결/에러 판정 헬퍼(isJobTerminal 등)는 실제 구현 유지(#141 단일 소스).
jest.mock("@clause-lens/db/analysis", () => ({
  ...jest.requireActual("@clause-lens/db/analysis"),
  confirmAnalysisResultTx: jest.fn(),
  confirmPageAnalysisTx: jest.fn(),
  upsertPageOcr: jest.fn(),
}));
jest.mock("./lib/image-validator");
jest.mock("./lib/box-mapper");

const confirmResultMock = confirmAnalysisResultTx as jest.MockedFunction<typeof confirmAnalysisResultTx>;
const confirmFailMock = confirmPageAnalysisTx as jest.MockedFunction<typeof confirmPageAnalysisTx>;
const upsertOcrMock = upsertPageOcr as jest.MockedFunction<typeof upsertPageOcr>;
const validateMock = validateImage as jest.MockedFunction<typeof validateImage>;
const mapMock = mapClauses as jest.MockedFunction<typeof mapClauses>;

const OCR = {
  imageWidth: 1000,
  imageHeight: 1400,
  orientation: "exif-normalized",
  blocks: [{ id: "b0", text: "자동 갱신 조항", box: { x: 1, y: 1, width: 10, height: 10 } }],
};

function makeJob(pages: { pageId: string; status: string }[], status = "queued") {
  return {
    id: "job1",
    documentId: "doc1",
    status,
    pages: pages.map((p, i) => ({
      id: `pa${i}`,
      pageId: p.pageId,
      revision: 1,
      status: p.status,
      page: {
        id: p.pageId,
        finalKey: `documents/doc1/${p.pageId}`,
        revision: 1,
        contentType: "image/jpeg",
      },
    })),
  };
}

function makeProcessor(
  analysisJob: unknown,
  opts: {
    existingOcr?: unknown;
    ocr?: Partial<OcrPort>;
    analyzer?: Partial<ClauseAnalyzerPort>;
  } = {},
) {
  const prisma = {
    analysisJob: { findUnique: jest.fn().mockResolvedValue(analysisJob) },
    pageOcr: { findUnique: jest.fn().mockResolvedValue(opts.existingOcr ?? null) },
  } as unknown as PrismaService;
  const ocr = { recognize: jest.fn().mockResolvedValue({ blocks: OCR.blocks }), ...opts.ocr } as OcrPort;
  const analyzer = {
    analyze: jest.fn().mockResolvedValue({ clauses: [{ blockIds: ["b0"], type: "auto_renewal", title: "자동 연장", description: "d", riskLevel: "high" }], model: "m" }),
    ...opts.analyzer,
  } as ClauseAnalyzerPort;
  const storage = {
    getObject: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  } as unknown as StoragePort;
  const publisher = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<NotificationPublisher>;
  const processor = new AnalysisProcessor(prisma, ocr, analyzer, storage, publisher);
  return { processor, prisma, ocr, analyzer, storage, publisher };
}

function job(attemptsMade = 0, attempts = 3): AnalysisJobRef {
  return { data: { jobId: "job1" }, attemptsMade, opts: { attempts } };
}

beforeEach(() => {
  confirmResultMock.mockResolvedValue({ applied: true, jobStatus: "done", documentStatus: "done", stateVersion: 2 });
  confirmFailMock.mockResolvedValue({ applied: true, jobStatus: "failed", documentStatus: "failed", stateVersion: 2 });
  upsertOcrMock.mockResolvedValue(OCR);
  validateMock.mockResolvedValue({ uprightBytes: Buffer.from([1]), width: 1000, height: 1400, format: "jpeg" });
  mapMock.mockReturnValue([
    { order: 0, type: "auto_renewal", title: "자동 연장", description: "d", riskLevel: "high", sourceText: "자동 갱신 조항", boxes: [{ x: 1, y: 1, width: 10, height: 10 }] },
  ]);
});

describe("AnalysisProcessor.process (0021)", () => {
  it("성공: OCR 없음 → Vision → upsert → 분석 → 결과 원자 확정 + publish", async () => {
    const { processor, ocr, publisher } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]));
    await processor.process(job());
    expect(ocr.recognize).toHaveBeenCalledTimes(1);
    expect(upsertOcrMock).toHaveBeenCalledTimes(1);
    expect(confirmResultMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ jobId: "job1", input: expect.objectContaining({ pageId: "pg1", model: "m" }) }));
    expect(publisher.publish).toHaveBeenCalledWith("doc1", 2);
  });

  it("OCR 재사용: 커밋된 PageOcr 있으면 Vision·다운로드 미호출", async () => {
    const existing = { ...OCR, inputFingerprint: `documents/doc1/pg1|${NORMALIZATION_VERSION}` };
    const { processor, ocr, storage } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]), { existingOcr: existing });
    await processor.process(job());
    expect(ocr.recognize).not.toHaveBeenCalled();
    expect(storage.getObject).not.toHaveBeenCalled();
    expect(upsertOcrMock).not.toHaveBeenCalled();
    expect(confirmResultMock).toHaveBeenCalledTimes(1);
  });

  it("분석 영구 실패: OCR은 보존(upsert됨), 페이지는 analysis_failed로 종결", async () => {
    const analyze = jest.fn().mockRejectedValue(new AnalysisPermanentError("analysis_failed"));
    const { processor } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]), { analyzer: { analyze } });
    await processor.process(job());
    expect(upsertOcrMock).toHaveBeenCalledTimes(1); // OCR 보존
    expect(confirmResultMock).not.toHaveBeenCalled();
    expect(confirmFailMock).toHaveBeenCalledWith(expect.anything(), { jobId: "job1", outcome: { pageId: "pg1", ok: false, errorCode: "analysis_failed", retryable: false } });
  });

  it("이미지 검증 실패 → invalid_image 종결, Vision 미호출", async () => {
    validateMock.mockRejectedValue(new ValidationError("invalid_image"));
    const { processor, ocr } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]));
    await processor.process(job());
    expect(ocr.recognize).not.toHaveBeenCalled();
    expect(confirmFailMock).toHaveBeenCalledWith(expect.anything(), { jobId: "job1", outcome: { pageId: "pg1", ok: false, errorCode: "invalid_image", retryable: false } });
  });

  it("텍스트 미검출(블록 0) → ocr_failed 종결", async () => {
    upsertOcrMock.mockResolvedValue({ ...OCR, blocks: [] });
    const { processor } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]), { ocr: { recognize: jest.fn().mockResolvedValue({ blocks: [] }) } });
    await processor.process(job());
    expect(confirmFailMock).toHaveBeenCalledWith(expect.anything(), { jobId: "job1", outcome: { pageId: "pg1", ok: false, errorCode: "ocr_failed", retryable: false } });
  });

  it("분석 일시 오류 & 예산 남음 → 확정 안 함 + job 재시도(throw)", async () => {
    const analyze = jest.fn().mockRejectedValue(new AnalysisTransientError("analysis_timeout"));
    const { processor } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]), { analyzer: { analyze } });
    await expect(processor.process(job(0, 3))).rejects.toThrow();
    expect(confirmResultMock).not.toHaveBeenCalled();
    expect(confirmFailMock).not.toHaveBeenCalled();
  });

  it("일시 오류 & 마지막 시도 → analysis_timeout(retryable) 종결", async () => {
    const analyze = jest.fn().mockRejectedValue(new AnalysisTransientError("analysis_timeout"));
    const { processor } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]), { analyzer: { analyze } });
    await processor.process(job(2, 3));
    expect(confirmFailMock).toHaveBeenCalledWith(expect.anything(), { jobId: "job1", outcome: { pageId: "pg1", ok: false, errorCode: "analysis_timeout", retryable: true } });
  });

  it("OCR 영구 오류 → ocr_failed 종결", async () => {
    const recognize = jest.fn().mockRejectedValue(new OcrPermanentError("ocr_failed"));
    const { processor } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]), { ocr: { recognize } });
    await processor.process(job());
    expect(confirmFailMock).toHaveBeenCalledWith(expect.anything(), { jobId: "job1", outcome: { pageId: "pg1", ok: false, errorCode: "ocr_failed", retryable: false } });
  });

  it("OCR stub 영구 오류(stub_disabled_in_production) → 계약 밖 코드는 analysis_failed로 치환 종결(#133)", async () => {
    const recognize = jest
      .fn()
      .mockRejectedValue(new OcrPermanentError("stub_disabled_in_production"));
    const { processor } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]), { ocr: { recognize } });
    await processor.process(job());
    expect(confirmFailMock).toHaveBeenCalledWith(expect.anything(), {
      jobId: "job1",
      outcome: { pageId: "pg1", ok: false, errorCode: "analysis_failed", retryable: false },
    });
  });

  it("분석 stub 영구 오류(stub_disabled_in_production) → 계약 밖 코드는 analysis_failed로 치환 종결(#133)", async () => {
    const analyze = jest
      .fn()
      .mockRejectedValue(new AnalysisPermanentError("stub_disabled_in_production"));
    const { processor } = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }]), { analyzer: { analyze } });
    await processor.process(job());
    expect(confirmFailMock).toHaveBeenCalledWith(expect.anything(), {
      jobId: "job1",
      outcome: { pageId: "pg1", ok: false, errorCode: "analysis_failed", retryable: false },
    });
  });

  it("완료된 페이지 skip · 종결된 job no-op", async () => {
    const { processor, ocr } = makeProcessor(makeJob([{ pageId: "pg1", status: "done" }]));
    await processor.process(job());
    expect(ocr.recognize).not.toHaveBeenCalled();

    const done = makeProcessor(makeJob([{ pageId: "pg1", status: "pending" }], "done"));
    await done.processor.process(job());
    expect(done.ocr.recognize).not.toHaveBeenCalled();
  });
});
