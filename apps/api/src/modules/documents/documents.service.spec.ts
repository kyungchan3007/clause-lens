import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PresignPageInput } from "@clause-lens/contracts";

import { DocumentsService } from "./documents.service";
import {
  type DocumentWithPages,
  DocumentsRepository,
} from "./documents.repository";

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

const pageInput: PresignPageInput = {
  order: 0,
  contentType: "image/jpeg",
  sizeBytes: 1000,
};

describe("DocumentsService.createOrGetSession", () => {
  let repo: jest.Mocked<DocumentsRepository>;
  let svc: DocumentsService;

  beforeEach(() => {
    repo = {
      findSessionByKey: jest.fn(),
      findOwnedSession: jest.fn(),
      countPendingSessions: jest.fn(),
      createSession: jest.fn(),
      confirmPagesTx: jest.fn(),
    } as unknown as jest.Mocked<DocumentsRepository>;
    svc = new DocumentsService(repo);
  });

  it("신규 세션 생성(제한 내)", async () => {
    repo.findSessionByKey.mockResolvedValue(null);
    repo.countPendingSessions.mockResolvedValue(0);
    const created = makeDoc();
    repo.createSession.mockResolvedValue(created);

    const r = await svc.createOrGetSession("u1", "req1", [pageInput]);
    expect(r).toBe(created);
    expect(repo.createSession).toHaveBeenCalledTimes(1);
  });

  it("같은 키·같은 payload → 기존 세션 재사용(생성 안 함)", async () => {
    repo.findSessionByKey.mockResolvedValue(makeDoc());
    const r = await svc.createOrGetSession("u1", "req1", [pageInput]);
    expect(r.id).toBe("doc1");
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it("같은 키·다른 payload → 409", async () => {
    repo.findSessionByKey.mockResolvedValue(makeDoc());
    await expect(
      svc.createOrGetSession("u1", "req1", [{ ...pageInput, sizeBytes: 2000 }]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("만료 세션에 같은 키 → 409", async () => {
    repo.findSessionByKey.mockResolvedValue(makeDoc({ status: "expired" }));
    await expect(
      svc.createOrGetSession("u1", "req1", [pageInput]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("미완료 세션 상한 초과 → 409", async () => {
    repo.findSessionByKey.mockResolvedValue(null);
    repo.countPendingSessions.mockResolvedValue(5);
    await expect(
      svc.createOrGetSession("u1", "req1", [pageInput]),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("DocumentsService.confirmPages", () => {
  it("repo가 null이면 NotFound", async () => {
    const repo = {
      confirmPagesTx: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<DocumentsRepository>;
    const svc = new DocumentsService(repo);
    await expect(svc.confirmPages("u1", "doc1", [])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
