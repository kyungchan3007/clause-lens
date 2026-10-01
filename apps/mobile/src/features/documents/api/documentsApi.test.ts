import { fetchDocumentReview, fetchRecentDocuments } from "./documentsApi";
import { HttpError } from "../../../shared/http";

const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const errStatus = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as Response;

const listBody = {
  items: [
    {
      documentId: "doc1",
      completedAt: "2026-10-01T05:00:00.000Z",
      retainUntil: "2026-10-08T05:00:00.000Z",
      status: "done",
      totalPageCount: 3,
      analyzedPageCount: 3,
      risk: { high: 1, medium: 0, low: 0 },
      label: "계약서 · 3장",
    },
  ],
  nextCursor: null,
};

describe("documentsApi.fetchRecentDocuments", () => {
  afterEach(() => jest.restoreAllMocks());

  it("정상: 파싱 + Authorization 헤더 + cursor 쿼리", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue(okJson(listBody));
    const r = await fetchRecentDocuments("tkn", "CUR SOR");
    expect(r.items[0].documentId).toBe("doc1");
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("/me/documents?cursor=CUR%20SOR");
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tkn");
  });

  it("커서 없으면 쿼리 없음", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue(okJson(listBody));
    await fetchRecentDocuments("tkn");
    expect(spy.mock.calls[0][0]).toContain("/me/documents");
    expect(spy.mock.calls[0][0]).not.toContain("?cursor");
  });

  it("HTTP 오류 → HttpError(status)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(401));
    await expect(fetchRecentDocuments("t")).rejects.toBeInstanceOf(HttpError);
  });

  it("스키마 불일치 → 거부(zod)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(okJson({ items: "nope" }));
    await expect(fetchRecentDocuments("t")).rejects.toBeTruthy();
  });
});

describe("documentsApi.fetchDocumentReview", () => {
  afterEach(() => jest.restoreAllMocks());

  it("410 → HttpError(410) (보관 경과 분기용)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(410));
    await fetchDocumentReview("t", "doc1").catch((e) =>
      expect((e as HttpError).status).toBe(410),
    );
  });
});
