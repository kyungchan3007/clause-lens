import { HttpError, complete, presign } from "./uploadApi";

const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const errStatus = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as Response;

const presignRes = {
  documentId: "doc1",
  sessionExpiresAt: "2026-09-22T10:00:00.000Z",
  pages: [
    {
      pageId: "pg1",
      order: 0,
      tmpKey: "tmp/u/doc1/pg1",
      uploadUrl: "https://minio.local/put?sig",
      expiresAt: "2026-09-22T09:10:00.000Z",
    },
  ],
};

const validReq = {
  clientRequestId: "req1",
  pages: [{ order: 0, contentType: "image/jpeg" as const, sizeBytes: 1000 }],
};

describe("uploadApi.presign", () => {
  afterEach(() => jest.restoreAllMocks());

  it("정상: 응답 파싱", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(okJson(presignRes));
    const r = await presign("token", validReq);
    expect(r.documentId).toBe("doc1");
    expect(r.pages[0].uploadUrl).toContain("https://");
  });

  it("Authorization 헤더 부착", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue(okJson(presignRes));
    await presign("tkn", validReq);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tkn");
  });

  it("잘못된 요청(빈 pages) → 스키마 오류(fetch 안 함)", async () => {
    const spy = jest.spyOn(global, "fetch");
    await expect(presign("token", { clientRequestId: "r", pages: [] })).rejects.toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });

  it("HTTP 오류 → HttpError(status)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(409));
    await expect(presign("token", validReq)).rejects.toBeInstanceOf(HttpError);
    await presign("token", validReq).catch((e) => expect((e as HttpError).status).toBe(409));
  });
});

describe("uploadApi.complete", () => {
  afterEach(() => jest.restoreAllMocks());

  it("정상: 페이지 결과 파싱", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      okJson({
        documentId: "doc1",
        status: "uploaded",
        pages: [{ pageId: "pg1", status: "uploaded" }],
      }),
    );
    const r = await complete("token", "doc1", ["pg1"]);
    expect(r.status).toBe("uploaded");
    expect(r.pages[0].status).toBe("uploaded");
  });

  it("401 → HttpError", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(401));
    await expect(complete("token", "doc1", ["pg1"])).rejects.toBeInstanceOf(HttpError);
  });
});
