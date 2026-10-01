import { GoneException, NotFoundException } from "@nestjs/common";

import { DocumentsService } from "./documents.service";
import {
  type DocumentWithPages,
  DocumentsRepository,
} from "./documents.repository";

function makeDoc(over: Partial<DocumentWithPages> = {}): DocumentWithPages {
  return {
    id: "doc1",
    userId: "u1",
    clientRequestId: "req1",
    status: "done",
    expiresAt: new Date(Date.now() - 3600_000), // 세션은 만료됐어도 재열람은 보관 기한으로 판정
    completedAt: new Date(Date.now() - 24 * 3600_000),
    retainUntil: new Date(Date.now() + 6 * 24 * 3600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    pages: [],
    ...over,
  } as DocumentWithPages;
}

describe("DocumentsService.getAnalysis 재열람 보관 게이트(0030)", () => {
  let repo: jest.Mocked<DocumentsRepository>;
  let svc: DocumentsService;

  beforeEach(() => {
    repo = {
      findOwnedSession: jest.fn(),
      findLatestAnalysis: jest.fn(),
      listRecentDocuments: jest.fn(),
    } as unknown as jest.Mocked<DocumentsRepository>;
    svc = new DocumentsService(repo);
  });

  it("보관 기한이 미래면 통과(세션 만료와 무관)", async () => {
    repo.findOwnedSession.mockResolvedValue(makeDoc());
    const job = { id: "job1" } as never;
    repo.findLatestAnalysis.mockResolvedValue(job);
    await expect(svc.getAnalysis("u1", "doc1")).resolves.toBe(job);
  });

  it("보관 기한이 지났으면 410(Gone)", async () => {
    repo.findOwnedSession.mockResolvedValue(
      makeDoc({ retainUntil: new Date(Date.now() - 1000) }),
    );
    await expect(svc.getAnalysis("u1", "doc1")).rejects.toBeInstanceOf(GoneException);
    expect(repo.findLatestAnalysis).not.toHaveBeenCalled();
  });

  it("retainUntil이 null(진행중)이면 통과 — 폴링을 막지 않는다", async () => {
    repo.findOwnedSession.mockResolvedValue(
      makeDoc({ status: "analyzing", completedAt: null, retainUntil: null }),
    );
    const job = { id: "jobA" } as never;
    repo.findLatestAnalysis.mockResolvedValue(job);
    await expect(svc.getAnalysis("u1", "doc1")).resolves.toBe(job);
  });

  it("타 사용자(소유 아님)는 404", async () => {
    repo.findOwnedSession.mockResolvedValue(null);
    await expect(svc.getAnalysis("intruder", "doc1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("DocumentsService.listRecentDocuments(0030)", () => {
  let repo: jest.Mocked<DocumentsRepository>;
  let svc: DocumentsService;

  beforeEach(() => {
    repo = {
      listRecentDocuments: jest.fn(),
    } as unknown as jest.Mocked<DocumentsRepository>;
    svc = new DocumentsService(repo);
  });

  it("커서 없이 조회 → DTO 매핑 + hasMore=false면 nextCursor=null", async () => {
    repo.listRecentDocuments.mockResolvedValue({
      items: [
        {
          documentId: "doc1",
          completedAt: new Date("2026-10-01T05:00:00.000Z"),
          retainUntil: new Date("2026-10-08T05:00:00.000Z"),
          status: "partial",
          totalPageCount: 3,
          analyzedPageCount: 2,
          risk: { high: 1, medium: 0, low: 1 },
        },
      ],
      hasMore: false,
    });

    const res = await svc.listRecentDocuments("u1", {});
    expect(repo.listRecentDocuments).toHaveBeenCalledWith("u1", {
      limit: undefined,
      before: undefined,
    });
    expect(res.items[0].label).toBe("계약서 · 3장");
    expect(res.items[0].status).toBe("partial");
    expect(res.nextCursor).toBeNull();
  });

  it("hasMore=true면 마지막 항목 커서를 발급하고, 그 커서로 재조회 시 before로 복원된다", async () => {
    const last = {
      documentId: "docZ",
      completedAt: new Date("2026-09-30T00:00:00.000Z"),
      retainUntil: new Date("2026-10-07T00:00:00.000Z"),
      status: "done" as const,
      totalPageCount: 1,
      analyzedPageCount: 1,
      risk: { high: 0, medium: 0, low: 0 },
    };
    repo.listRecentDocuments.mockResolvedValue({ items: [last], hasMore: true });

    const page1 = await svc.listRecentDocuments("u1", { limit: 1 });
    expect(page1.nextCursor).toBeTruthy();

    repo.listRecentDocuments.mockResolvedValue({ items: [], hasMore: false });
    await svc.listRecentDocuments("u1", { cursor: page1.nextCursor!, limit: 1 });
    expect(repo.listRecentDocuments).toHaveBeenLastCalledWith("u1", {
      limit: 1,
      before: { completedAt: last.completedAt, id: "docZ" },
    });
  });
});
