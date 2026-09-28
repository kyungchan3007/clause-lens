import { confirmPageAnalysisTx } from "@clause-lens/db/analysis";

import { AnalysisProcessor, type AnalysisJobRef } from "./analysis.processor";
import type { NotificationPublisher } from "./notification.publisher";
import type { PrismaService } from "./prisma.service";
import {
  OcrPermanentError,
  OcrTransientError,
  type OcrPort,
} from "./ports/ocr.port";

jest.mock("@clause-lens/db/analysis");

const confirmMock = confirmPageAnalysisTx as jest.MockedFunction<
  typeof confirmPageAnalysisTx
>;

interface Row {
  pageId: string;
  status: string;
}

function makeAnalysisJob(pages: Row[], status = "queued") {
  return {
    id: "job1",
    documentId: "doc1",
    status,
    pages: pages.map((p, i) => ({
      pageId: p.pageId,
      revision: 1,
      status: p.status,
      page: { id: p.pageId, finalKey: `documents/doc1/${p.pageId}` },
      // 나머지 컬럼은 processor가 안 쓰므로 생략
      id: `pa${i}`,
    })),
  };
}

function makeProcessor(analysisJob: unknown, ocr: Partial<OcrPort>) {
  const prisma = {
    analysisJob: { findUnique: jest.fn().mockResolvedValue(analysisJob) },
  } as unknown as PrismaService;
  const publisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationPublisher>;
  const processor = new AnalysisProcessor(prisma, ocr as OcrPort, publisher);
  return { processor, publisher };
}

function job(attemptsMade = 0, attempts = 3): AnalysisJobRef {
  return { data: { jobId: "job1" }, attemptsMade, opts: { attempts } };
}

beforeEach(() => {
  confirmMock.mockResolvedValue({
    applied: true,
    jobStatus: "processing",
    documentStatus: "analyzing",
    stateVersion: 2,
  });
});

describe("AnalysisProcessor.process", () => {
  it("성공 → confirm(ok) + publish", async () => {
    const analyzePage = jest.fn().mockResolvedValue({});
    const { processor, publisher } = makeProcessor(
      makeAnalysisJob([{ pageId: "pg1", status: "pending" }]),
      { analyzePage },
    );

    await processor.process(job());
    expect(analyzePage).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledWith(expect.anything(), {
      jobId: "job1",
      outcome: { pageId: "pg1", ok: true },
    });
    expect(publisher.publish).toHaveBeenCalledWith("doc1", 2);
  });

  it("영구 오류 → confirm(fail, 비재시도)", async () => {
    const analyzePage = jest
      .fn()
      .mockRejectedValue(new OcrPermanentError("ocr_failed"));
    const { processor } = makeProcessor(
      makeAnalysisJob([{ pageId: "pg1", status: "pending" }]),
      { analyzePage },
    );

    await processor.process(job());
    expect(confirmMock).toHaveBeenCalledWith(expect.anything(), {
      jobId: "job1",
      outcome: {
        pageId: "pg1",
        ok: false,
        errorCode: "ocr_failed",
        retryable: false,
      },
    });
  });

  it("일시 오류 & 예산 남음 → confirm 안 함 + job 재시도(throw)", async () => {
    const analyzePage = jest
      .fn()
      .mockRejectedValue(new OcrTransientError("ocr_timeout"));
    const { processor } = makeProcessor(
      makeAnalysisJob([{ pageId: "pg1", status: "pending" }]),
      { analyzePage },
    );

    await expect(processor.process(job(0, 3))).rejects.toThrow();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("일시 오류 & 마지막 시도 → confirm(fail, 사용자 재시도 가능)", async () => {
    const analyzePage = jest
      .fn()
      .mockRejectedValue(new OcrTransientError("ocr_timeout"));
    const { processor } = makeProcessor(
      makeAnalysisJob([{ pageId: "pg1", status: "pending" }]),
      { analyzePage },
    );

    await processor.process(job(2, 3)); // attemptsMade+1 === attempts
    expect(confirmMock).toHaveBeenCalledWith(expect.anything(), {
      jobId: "job1",
      outcome: {
        pageId: "pg1",
        ok: false,
        errorCode: "ocr_timeout",
        retryable: true,
      },
    });
  });

  it("이미 완료된 페이지는 건너뛴다(재실행 안전)", async () => {
    const analyzePage = jest.fn().mockResolvedValue({});
    const { processor } = makeProcessor(
      makeAnalysisJob([{ pageId: "pg1", status: "done" }]),
      { analyzePage },
    );

    await processor.process(job());
    expect(analyzePage).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("이미 종결된 job → 아무것도 안 함", async () => {
    const analyzePage = jest.fn().mockResolvedValue({});
    const { processor } = makeProcessor(
      makeAnalysisJob([{ pageId: "pg1", status: "pending" }], "done"),
      { analyzePage },
    );

    await processor.process(job());
    expect(analyzePage).not.toHaveBeenCalled();
  });
});
