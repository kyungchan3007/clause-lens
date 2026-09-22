import {
  MAX_PAGES_PER_DOCUMENT,
  MAX_PAGE_SIZE_BYTES,
  completeResponseSchema,
  presignRequestSchema,
} from "./uploads";

const validPage = {
  order: 0,
  contentType: "image/jpeg" as const,
  sizeBytes: 1024,
};

describe("presignRequestSchema", () => {
  it("유효 요청 파싱", () => {
    const r = presignRequestSchema.safeParse({
      clientRequestId: "req-1",
      pages: [validPage, { ...validPage, order: 1 }],
    });
    expect(r.success).toBe(true);
  });

  it("허용 밖 MIME 거부", () => {
    const r = presignRequestSchema.safeParse({
      clientRequestId: "req-1",
      pages: [{ ...validPage, contentType: "image/gif" }],
    });
    expect(r.success).toBe(false);
  });

  it("최대 크기 초과 거부", () => {
    const r = presignRequestSchema.safeParse({
      clientRequestId: "req-1",
      pages: [{ ...validPage, sizeBytes: MAX_PAGE_SIZE_BYTES + 1 }],
    });
    expect(r.success).toBe(false);
  });

  it("order 중복 거부", () => {
    const r = presignRequestSchema.safeParse({
      clientRequestId: "req-1",
      pages: [validPage, { ...validPage, order: 0 }],
    });
    expect(r.success).toBe(false);
  });

  it("페이지 수 상한 초과 거부", () => {
    const pages = Array.from({ length: MAX_PAGES_PER_DOCUMENT + 1 }, (_, i) => ({
      ...validPage,
      order: i,
    }));
    const r = presignRequestSchema.safeParse({ clientRequestId: "req-1", pages });
    expect(r.success).toBe(false);
  });

  it("clientRequestId 누락 거부", () => {
    const r = presignRequestSchema.safeParse({ pages: [validPage] });
    expect(r.success).toBe(false);
  });
});

describe("completeResponseSchema", () => {
  it("페이지별 결과 파싱", () => {
    const r = completeResponseSchema.safeParse({
      documentId: "doc1",
      status: "uploaded",
      pages: [
        { pageId: "p1", status: "uploaded" },
        { pageId: "p2", status: "pending", error: "copy_failed", retryable: true },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("알 수 없는 status 거부", () => {
    const r = completeResponseSchema.safeParse({
      documentId: "doc1",
      status: "weird",
      pages: [],
    });
    expect(r.success).toBe(false);
  });
});
