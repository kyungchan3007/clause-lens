import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from "@nestjs/common";

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
    expiresAt: new Date(Date.now() - 3600_000),
    completedAt: new Date(Date.now() - 24 * 3600_000),
    retainUntil: new Date(Date.now() + 6 * 24 * 3600_000),
    retentionState: "TEMPORARY",
    savedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    pages: [],
    ...over,
  } as DocumentWithPages;
}

// 저장(TEMPORARY→SAVED) 결정표(#163). CAS가 단일 권위, pre-load/재조회는 에러코드 산출용.
describe("DocumentsService.saveDocument 결정표(#163)", () => {
  let repo: jest.Mocked<DocumentsRepository>;
  let svc: DocumentsService;

  beforeEach(() => {
    repo = {
      findOwnedSession: jest.fn(),
      userCanSave: jest.fn(),
      saveDocumentCas: jest.fn(),
    } as unknown as jest.Mocked<DocumentsRepository>;
    svc = new DocumentsService(repo);
  });

  it("미소유 → 404 (권한·CAS 호출 안 함)", async () => {
    repo.findOwnedSession.mockResolvedValue(null);
    await expect(svc.saveDocument("intruder", "doc1")).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.userCanSave).not.toHaveBeenCalled();
    expect(repo.saveDocumentCas).not.toHaveBeenCalled();
  });

  it("이미 SAVED → 200 멱등(구독 재확인·CAS 없이)", async () => {
    const savedAt = new Date("2026-10-08T00:00:00.000Z");
    repo.findOwnedSession.mockResolvedValue(makeDoc({ retentionState: "SAVED", savedAt }));
    const res = await svc.saveDocument("u1", "doc1");
    expect(res).toEqual({ documentId: "doc1", retentionState: "SAVED", savedAt: savedAt.toISOString() });
    expect(repo.userCanSave).not.toHaveBeenCalled();
    expect(repo.saveDocumentCas).not.toHaveBeenCalled();
  });

  it("미구독 → 403 (CAS 호출 안 함)", async () => {
    repo.findOwnedSession.mockResolvedValue(makeDoc());
    repo.userCanSave.mockResolvedValue(false);
    await expect(svc.saveDocument("u1", "doc1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.saveDocumentCas).not.toHaveBeenCalled();
  });

  it("구독·CAS 1행 → 200 SAVED", async () => {
    repo.findOwnedSession.mockResolvedValue(makeDoc());
    repo.userCanSave.mockResolvedValue(true);
    repo.saveDocumentCas.mockResolvedValue(1);
    const res = await svc.saveDocument("u1", "doc1");
    expect(res.retentionState).toBe("SAVED");
    expect(res.documentId).toBe("doc1");
    expect(typeof res.savedAt).toBe("string");
  });

  it("CAS 0행 + 재조회 SAVED(동시 더블탭 패자) → 200 멱등", async () => {
    repo.findOwnedSession
      .mockResolvedValueOnce(makeDoc()) // pre-load: TEMPORARY
      .mockResolvedValueOnce(makeDoc({ retentionState: "SAVED", savedAt: new Date() })); // 재조회
    repo.userCanSave.mockResolvedValue(true);
    repo.saveDocumentCas.mockResolvedValue(0);
    const res = await svc.saveDocument("u1", "doc1");
    expect(res.retentionState).toBe("SAVED");
  });

  it("CAS 0행 + 재조회 미완료 → 409", async () => {
    repo.findOwnedSession
      .mockResolvedValueOnce(makeDoc())
      .mockResolvedValueOnce(makeDoc({ status: "analyzing", retainUntil: null }));
    repo.userCanSave.mockResolvedValue(true);
    repo.saveDocumentCas.mockResolvedValue(0);
    await expect(svc.saveDocument("u1", "doc1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("CAS 0행 + 재조회 TEMPORARY·만료 → 410", async () => {
    repo.findOwnedSession
      .mockResolvedValueOnce(makeDoc())
      .mockResolvedValueOnce(makeDoc({ retainUntil: new Date(Date.now() - 1000) }));
    repo.userCanSave.mockResolvedValue(true);
    repo.saveDocumentCas.mockResolvedValue(0);
    await expect(svc.saveDocument("u1", "doc1")).rejects.toBeInstanceOf(GoneException);
  });

  it("CAS 0행 + 재조회에서 문서 사라짐 → 404", async () => {
    repo.findOwnedSession.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
    repo.userCanSave.mockResolvedValue(true);
    repo.saveDocumentCas.mockResolvedValue(0);
    await expect(svc.saveDocument("u1", "doc1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
