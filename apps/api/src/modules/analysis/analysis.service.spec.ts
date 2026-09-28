import type { AnalysisJobWithPages } from "../documents/documents.repository";
import type { DocumentsService } from "../documents/documents.service";
import type { QueuePort } from "../../ports/queue.port";
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
    svc = new AnalysisService(documents, queue);
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
    const svc = new AnalysisService(documents, queue);

    const n = await svc.recoverUndispatched();
    expect(n).toBe(2);
    expect(queue.enqueueAnalysis).toHaveBeenCalledTimes(2);
    expect(documents.markDispatched).toHaveBeenCalledTimes(2);
  });
});
