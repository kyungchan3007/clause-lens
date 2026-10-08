import { normalizedImageKey } from "@clause-lens/contracts";

import type { AnalysisJobWithPages } from "../documents/documents.repository";
import type { DocumentsService } from "../documents/documents.service";
import type { QueuePort } from "../../ports/queue.port";
import type { StoragePort } from "../../ports/storage.port";
import { AnalysisService } from "./analysis.service";

function makeJob(over: Partial<AnalysisJobWithPages> = {}): AnalysisJobWithPages {
  return {
    id: "job1",
    documentId: "doc1",
    status: "queued",
    totalPages: 1,
    stateVersion: 1,
    dispatchedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    document: { id: "doc1", status: "analyzing" },
    pages: [
      {
        id: "pa1",
        jobId: "job1",
        pageId: "pg1",
        revision: 1,
        status: "pending",
        errorCode: null,
        retryable: false,
        attempts: 0,
        confirmedAt: null,
        createdAt: new Date(),
        page: { order: 0, revision: 1 },
      },
    ],
    ...over,
  } as AnalysisJobWithPages;
}

describe("AnalysisService.analyze", () => {
  let documents: jest.Mocked<DocumentsService>;
  let queue: jest.Mocked<QueuePort>;
  let storage: jest.Mocked<StoragePort>;
  let svc: AnalysisService;

  beforeEach(() => {
    documents = {
      startAnalysis: jest.fn(),
      getAnalysis: jest.fn(),
      markDispatched: jest.fn().mockResolvedValue(undefined),
      findUndispatchedActiveJobIds: jest.fn(),
    } as unknown as jest.Mocked<DocumentsService>;
    queue = {
      enqueueAnalysis: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueuePort>;
    storage = {
      presignGet: jest.fn().mockResolvedValue("https://minio/get?sig"),
    } as unknown as jest.Mocked<StoragePort>;
    svc = new AnalysisService(documents, queue, storage);
  });

  it("미전달 job 접수 → enqueue + 전달기록 + 매핑 응답", async () => {
    documents.startAnalysis.mockResolvedValue(makeJob({ dispatchedAt: null }));

    const r = await svc.analyze("u1", "doc1");
    expect(queue.enqueueAnalysis).toHaveBeenCalledWith("job1");
    expect(documents.markDispatched).toHaveBeenCalledWith("job1");
    expect(r.jobId).toBe("job1");
    expect(r.stateVersion).toBe(1);
    expect(r.pages[0]).toMatchObject({ pageId: "pg1", order: 0 });
  });

  it("이미 전달된 job(멱등 재요청) → enqueue 안 함", async () => {
    documents.startAnalysis.mockResolvedValue(
      makeJob({ dispatchedAt: new Date(), status: "processing" }),
    );

    await svc.analyze("u1", "doc1");
    expect(queue.enqueueAnalysis).not.toHaveBeenCalled();
    expect(documents.markDispatched).not.toHaveBeenCalled();
  });

  it("정규화 치수 있는 페이지 → normalizedImage(presigned GET) 부착(#175)", async () => {
    documents.startAnalysis.mockResolvedValue(
      makeJob({
        dispatchedAt: new Date(),
        status: "processing",
        pages: [
          {
            id: "pa1",
            jobId: "job1",
            pageId: "pg1",
            revision: 2,
            status: "done",
            errorCode: null,
            retryable: false,
            attempts: 0,
            confirmedAt: new Date(),
            createdAt: new Date(),
            page: {
              order: 0,
              revision: 2,
              ocrResults: [{ revision: 2, imageWidth: 1000, imageHeight: 1400 }],
              analysisResults: [],
            },
          },
        ],
      } as unknown as Partial<AnalysisJobWithPages>),
    );

    const r = await svc.analyze("u1", "doc1");
    expect(storage.presignGet).toHaveBeenCalledWith(
      normalizedImageKey("doc1", "pg1", 2),
      expect.any(Number),
    );
    expect(r.pages[0].normalizedImage).toEqual({
      url: "https://minio/get?sig",
      width: 1000,
      height: 1400,
      revision: 2,
    });
  });

  it("치수 없는 페이지(미완) → normalizedImage·presign 없음", async () => {
    documents.startAnalysis.mockResolvedValue(makeJob({ dispatchedAt: new Date() }));
    const r = await svc.analyze("u1", "doc1");
    expect(storage.presignGet).not.toHaveBeenCalled();
    expect(r.pages[0].normalizedImage).toBeUndefined();
  });

  it("presign 실패(S3 장애)해도 결과는 유지 — 해당 페이지만 normalizedImage 미부착(500 방지)", async () => {
    storage.presignGet.mockRejectedValue(new Error("s3 down"));
    documents.startAnalysis.mockResolvedValue(
      makeJob({
        dispatchedAt: new Date(),
        status: "processing",
        pages: [
          {
            id: "pa1",
            jobId: "job1",
            pageId: "pg1",
            revision: 2,
            status: "done",
            errorCode: null,
            retryable: false,
            attempts: 0,
            confirmedAt: new Date(),
            createdAt: new Date(),
            page: {
              order: 0,
              revision: 2,
              ocrResults: [{ revision: 2, imageWidth: 1000, imageHeight: 1400 }],
              analysisResults: [],
            },
          },
        ],
      } as unknown as Partial<AnalysisJobWithPages>),
    );

    const r = await svc.analyze("u1", "doc1"); // reject 전파되면 throw → 이 await가 실패
    expect(r.pages[0].imageWidth).toBe(1000); // 결과(치수·조항)는 그대로
    expect(r.pages[0].normalizedImage).toBeUndefined(); // 이미지만 미부착
  });
});

describe("AnalysisService.recoverUndispatched", () => {
  it("미전달 활성 job 재전달 + 전달기록", async () => {
    const documents = {
      findUndispatchedActiveJobIds: jest.fn().mockResolvedValue(["a", "b"]),
      markDispatched: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DocumentsService>;
    const queue = {
      enqueueAnalysis: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueuePort>;
    const storage = {
      presignGet: jest.fn(),
    } as unknown as jest.Mocked<StoragePort>;
    const svc = new AnalysisService(documents, queue, storage);

    const n = await svc.recoverUndispatched();
    expect(n).toBe(2);
    expect(queue.enqueueAnalysis).toHaveBeenCalledTimes(2);
    expect(documents.markDispatched).toHaveBeenCalledTimes(2);
  });
});
