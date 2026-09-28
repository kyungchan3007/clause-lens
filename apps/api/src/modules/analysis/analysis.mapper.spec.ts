import type { AnalysisJobWithPages } from "../documents/documents.repository";
import { toStatusResponse } from "./analysis.mapper";

const job = {
  id: "job1",
  documentId: "doc1",
  status: "partial",
  totalPages: 2,
  stateVersion: 5,
  dispatchedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  document: { id: "doc1", status: "partial" },
  pages: [
    {
      id: "pa1",
      jobId: "job1",
      pageId: "pg1",
      revision: 1,
      status: "done",
      errorCode: null,
      retryable: false,
      attempts: 1,
      confirmedAt: new Date(),
      createdAt: new Date(),
      page: { order: 0, revision: 1 },
    },
    {
      id: "pa2",
      jobId: "job1",
      pageId: "pg2",
      revision: 1,
      status: "failed",
      errorCode: "ocr_failed",
      retryable: false,
      attempts: 1,
      confirmedAt: new Date(),
      createdAt: new Date(),
      page: { order: 1, revision: 1 },
    },
  ],
} as unknown as AnalysisJobWithPages;

describe("toStatusResponse", () => {
  it("job·document·페이지 상태를 계약 shape로 매핑", () => {
    const r = toStatusResponse(job);
    expect(r).toMatchObject({
      jobId: "job1",
      documentId: "doc1",
      status: "partial",
      stateVersion: 5,
      job: { status: "partial", totalPages: 2 },
    });
    expect(r.pages).toHaveLength(2);
    expect(r.pages[0]).toMatchObject({
      pageId: "pg1",
      order: 0,
      status: "done",
      revision: 1,
    });
    expect(r.pages[0].errorCode).toBeUndefined();
    expect(r.pages[1]).toMatchObject({
      pageId: "pg2",
      status: "failed",
      errorCode: "ocr_failed",
      retryable: false,
    });
  });
});
