import {
  analysisStatusResponseSchema,
  analyzeResponseSchema,
  pageAnalysisResultSchema,
} from "./analysis";

const validStatus = {
  jobId: "job1",
  documentId: "doc1",
  status: "analyzing" as const,
  stateVersion: 1,
  job: { status: "processing" as const, totalPages: 2 },
  pages: [
    { pageId: "p1", order: 0, status: "done" as const, revision: 1 },
    {
      pageId: "p2",
      order: 1,
      status: "failed" as const,
      revision: 1,
      errorCode: "ocr_failed" as const,
      retryable: true,
    },
  ],
};

describe("analysisStatusResponseSchema", () => {
  it("유효 상태 응답 파싱(페이지별 결과·errorCode 포함)", () => {
    const r = analysisStatusResponseSchema.safeParse(validStatus);
    expect(r.success).toBe(true);
  });

  it("analyze 응답 = status 응답과 동일 shape", () => {
    const r = analyzeResponseSchema.safeParse({ ...validStatus, status: "done" });
    expect(r.success).toBe(true);
  });

  it("stateVersion 은 양의 정수여야 함", () => {
    const r = analysisStatusResponseSchema.safeParse({
      ...validStatus,
      stateVersion: 0,
    });
    expect(r.success).toBe(false);
  });

  it("알 수 없는 문서 status 거부", () => {
    const r = analysisStatusResponseSchema.safeParse({
      ...validStatus,
      status: "weird",
    });
    expect(r.success).toBe(false);
  });

  it("알 수 없는 job status 거부", () => {
    const r = analysisStatusResponseSchema.safeParse({
      ...validStatus,
      job: { status: "cancelled", totalPages: 2 },
    });
    expect(r.success).toBe(false);
  });
});

describe("pageAnalysisResultSchema", () => {
  it("허용 밖 errorCode 거부", () => {
    const r = pageAnalysisResultSchema.safeParse({
      pageId: "p1",
      order: 0,
      status: "failed",
      revision: 1,
      errorCode: "boom",
    });
    expect(r.success).toBe(false);
  });

  it("errorCode·retryable 은 선택(성공 페이지)", () => {
    const r = pageAnalysisResultSchema.safeParse({
      pageId: "p1",
      order: 0,
      status: "done",
      revision: 2,
    });
    expect(r.success).toBe(true);
  });
});
