import { BadRequestException } from "@nestjs/common";

import { DocumentsService } from "../documents/documents.service";
import type { DocumentWithPages } from "../documents/documents.repository";
import { StoragePort } from "../../ports/storage.port";
import { UploadsService } from "./uploads.service";

const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);

function makePage(over: Partial<DocumentWithPages["pages"][number]> = {}) {
  return {
    id: "pg1",
    documentId: "doc1",
    order: 0,
    revision: 1,
    contentType: "image/jpeg",
    expectedSize: 1000,
    width: null,
    height: null,
    finalKey: null,
    status: "pending",
    confirmedAt: null,
    createdAt: new Date(),
    ...over,
  } as DocumentWithPages["pages"][number];
}
function makeDoc(over: Partial<DocumentWithPages> = {}): DocumentWithPages {
  return {
    id: "doc1",
    userId: "u1",
    clientRequestId: "req1",
    status: "draft",
    expiresAt: new Date(Date.now() + 3600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    pages: [makePage()],
    ...over,
  } as DocumentWithPages;
}

describe("UploadsService", () => {
  let documents: jest.Mocked<DocumentsService>;
  let storage: jest.Mocked<StoragePort>;
  let svc: UploadsService;

  beforeEach(() => {
    documents = {
      createOrGetSession: jest.fn(),
      getOwnedSession: jest.fn(),
      confirmPages: jest.fn(),
    } as unknown as jest.Mocked<DocumentsService>;
    storage = {
      presignPut: jest.fn().mockResolvedValue("https://minio/put?sig"),
      head: jest.fn(),
      copy: jest.fn().mockResolvedValue(undefined),
      getHeadBytes: jest.fn().mockResolvedValue(JPEG_MAGIC),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<StoragePort>;
    svc = new UploadsService(documents, storage);
  });

  it("presign: 페이지별 티켓 발급", async () => {
    documents.createOrGetSession.mockResolvedValue(makeDoc());
    const r = await svc.presign("u1", { clientRequestId: "req1", pages: [] as never });
    expect(r.documentId).toBe("doc1");
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].uploadUrl).toContain("https://minio");
    expect(storage.presignPut).toHaveBeenCalledTimes(1);
  });

  it("complete 정상: 검증·copy·확정 → uploaded", async () => {
    documents.getOwnedSession.mockResolvedValue(makeDoc());
    storage.head.mockResolvedValue({ exists: true, size: 1000, etag: '"abc"' });
    documents.confirmPages.mockResolvedValue(
      makeDoc({
        status: "uploaded",
        pages: [makePage({ status: "uploaded", finalKey: "documents/doc1/..." })],
      }),
    );

    const r = await svc.complete("u1", "doc1", ["pg1"]);
    expect(storage.copy).toHaveBeenCalledTimes(1);
    expect(storage.copy).toHaveBeenCalledWith(
      expect.objectContaining({ ifMatchETag: '"abc"' }),
    );
    expect(r.status).toBe("uploaded");
    expect(r.pages[0]).toEqual({ pageId: "pg1", status: "uploaded" });
    expect(storage.delete).toHaveBeenCalledTimes(1); // 임시키 정리
  });

  it("complete 크기 불일치: pending + size_mismatch(retryable)", async () => {
    documents.getOwnedSession.mockResolvedValue(makeDoc());
    storage.head.mockResolvedValue({ exists: true, size: 999, etag: '"abc"' });
    documents.confirmPages.mockResolvedValue(makeDoc());

    const r = await svc.complete("u1", "doc1", ["pg1"]);
    expect(storage.copy).not.toHaveBeenCalled();
    expect(r.pages[0]).toMatchObject({
      status: "pending",
      error: "size_mismatch",
      retryable: true,
    });
  });

  it("complete 위장 이미지(매직 불일치): invalid_image(retryable=false)", async () => {
    documents.getOwnedSession.mockResolvedValue(makeDoc());
    storage.head.mockResolvedValue({ exists: true, size: 1000, etag: '"abc"' });
    storage.getHeadBytes.mockResolvedValue(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
    documents.confirmPages.mockResolvedValue(makeDoc());

    const r = await svc.complete("u1", "doc1", ["pg1"]);
    expect(storage.copy).not.toHaveBeenCalled();
    expect(r.pages[0]).toMatchObject({ error: "invalid_image", retryable: false });
  });

  it("complete 미업로드: not_uploaded(retryable)", async () => {
    documents.getOwnedSession.mockResolvedValue(makeDoc());
    storage.head.mockResolvedValue({ exists: false, size: 0 });
    documents.confirmPages.mockResolvedValue(makeDoc());

    const r = await svc.complete("u1", "doc1", ["pg1"]);
    expect(r.pages[0]).toMatchObject({ error: "not_uploaded", retryable: true });
  });

  it("complete: 문서에 없는 pageId → 400", async () => {
    documents.getOwnedSession.mockResolvedValue(makeDoc());
    await expect(svc.complete("u1", "doc1", ["nope"])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("complete 멱등: 이미 uploaded면 저장소 접근 없이 현재 상태", async () => {
    documents.getOwnedSession.mockResolvedValue(
      makeDoc({ status: "uploaded", pages: [makePage({ status: "uploaded" })] }),
    );
    const r = await svc.complete("u1", "doc1", ["pg1"]);
    expect(r.status).toBe("uploaded");
    expect(storage.head).not.toHaveBeenCalled();
    expect(documents.confirmPages).not.toHaveBeenCalled();
  });

  it("reprisign: 미확정 페이지만 티켓, 없는 pageId → 400", async () => {
    documents.getOwnedSession.mockResolvedValue(makeDoc());
    const ok = await svc.reprisign("u1", "doc1", ["pg1"]);
    expect(ok.pages).toHaveLength(1);
    await expect(svc.reprisign("u1", "doc1", ["nope"])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
