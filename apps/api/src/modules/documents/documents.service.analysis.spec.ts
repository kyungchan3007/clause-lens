import { ConflictException, NotFoundException } from "@nestjs/common";

import { DocumentsService } from "./documents.service";
import type {
  AnalysisJobWithPages,
  DocumentWithPages,
  DocumentsRepository,
} from "./documents.repository";

function makeDoc(over: Partial<DocumentWithPages> = {}): DocumentWithPages {
  return {
    id: "doc1",
    userId: "u1",
    clientRequestId: "req1",
    status: "uploaded",
    expiresAt: new Date(Date.now() + 3600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    pages: [
      {
        id: "pg1",
        documentId: "doc1",
        order: 0,
        revision: 1,
        contentType: "image/jpeg",
        expectedSize: 1000,
        width: null,
        height: null,
        finalKey: "documents/doc1/pages/pg1/r1/x",
        status: "uploaded",
        confirmedAt: new Date(),
        createdAt: new Date(),
      },
    ],
    ...over,
  } as DocumentWithPages;
}

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

function makeRepo(): jest.Mocked<DocumentsRepository> {
  return {
    findOwnedSession: jest.fn(),
    findLatestAnalysis: jest.fn(),
    createAnalysisJob: jest.fn(),
    markDispatched: jest.fn(),
    findUndispatchedActiveJobIds: jest.fn(),
  } as unknown as jest.Mocked<DocumentsRepository>;
}

describe("DocumentsService.startAnalysis", () => {
  it("소유 문서 없음 → NotFound", async () => {
    const repo = makeRepo();
    repo.findOwnedSession.mockResolvedValue(null);
    const svc = new DocumentsService(repo);
    await expect(svc.startAnalysis("u1", "doc1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("기존 분석 있으면 그대로 반환(멱등, 생성 안 함)", async () => {
    const repo = makeRepo();
    repo.findOwnedSession.mockResolvedValue(makeDoc());
    const existing = makeJob({ status: "done" });
    repo.findLatestAnalysis.mockResolvedValue(existing);
    const svc = new DocumentsService(repo);

    const r = await svc.startAnalysis("u1", "doc1");
    expect(r).toBe(existing);
    expect(repo.createAnalysisJob).not.toHaveBeenCalled();
  });

  it("업로드 확정 전(uploaded 아님) + 기존 없음 → 409", async () => {
    const repo = makeRepo();
    repo.findOwnedSession.mockResolvedValue(makeDoc({ status: "draft" }));
    repo.findLatestAnalysis.mockResolvedValue(null);
    const svc = new DocumentsService(repo);
    await expect(svc.startAnalysis("u1", "doc1")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("uploaded + 기존 없음 → 접수 생성", async () => {
    const repo = makeRepo();
    repo.findOwnedSession.mockResolvedValue(makeDoc());
    repo.findLatestAnalysis.mockResolvedValue(null);
    const created = makeJob();
    repo.createAnalysisJob.mockResolvedValue(created);
    const svc = new DocumentsService(repo);

    const r = await svc.startAnalysis("u1", "doc1");
    expect(r).toBe(created);
    expect(repo.createAnalysisJob).toHaveBeenCalledWith("doc1", [
      { pageId: "pg1", revision: 1 },
    ]);
  });

  it("동시 접수 경쟁(P2002) → 승자 job 재조회 반환", async () => {
    const repo = makeRepo();
    repo.findOwnedSession.mockResolvedValue(makeDoc());
    const winner = makeJob();
    // 첫 조회 null(생성 시도) → P2002 → 재조회 승자
    repo.findLatestAnalysis
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    repo.createAnalysisJob.mockRejectedValue({ code: "P2002" });
    const svc = new DocumentsService(repo);

    const r = await svc.startAnalysis("u1", "doc1");
    expect(r).toBe(winner);
  });
});

describe("DocumentsService.getAnalysis", () => {
  it("분석 job 없음 → NotFound", async () => {
    const repo = makeRepo();
    repo.findOwnedSession.mockResolvedValue(makeDoc());
    repo.findLatestAnalysis.mockResolvedValue(null);
    const svc = new DocumentsService(repo);
    await expect(svc.getAnalysis("u1", "doc1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("job 있으면 반환", async () => {
    const repo = makeRepo();
    repo.findOwnedSession.mockResolvedValue(makeDoc());
    const job = makeJob();
    repo.findLatestAnalysis.mockResolvedValue(job);
    const svc = new DocumentsService(repo);
    expect(await svc.getAnalysis("u1", "doc1")).toBe(job);
  });
});
