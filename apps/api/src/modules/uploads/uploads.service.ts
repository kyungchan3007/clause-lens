import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import type {
  CompleteResponse,
  PageResult,
  PresignRequest,
  PresignResponse,
  ReprisignResponse,
  UploadTicket,
} from "@clause-lens/contracts";
import type { Page } from "@clause-lens/db";

import { DocumentsService } from "../documents/documents.service";
import {
  type DocumentWithPages,
  type PageConfirmation,
} from "../documents/documents.repository";
import { StoragePort } from "../../ports/storage.port";

const URL_TTL_SECONDS = 600; // presigned URL 만료(10분). 세션 만료와 분리.
const MAGIC_LEN = 12;

// 검증·서명·copy 오케스트레이션. 상태 변경은 DocumentsService로만.
@Injectable()
export class UploadsService {
  constructor(
    private readonly documents: DocumentsService,
    private readonly storage: StoragePort,
  ) {}

  async presign(userId: string, req: PresignRequest): Promise<PresignResponse> {
    const doc = await this.documents.createOrGetSession(
      userId,
      req.clientRequestId,
      req.pages,
    );
    const pages = await this.issueTickets(userId, doc, doc.pages);
    return {
      documentId: doc.id,
      sessionExpiresAt: doc.expiresAt.toISOString(),
      pages,
    };
  }

  async reprisign(
    userId: string,
    documentId: string,
    pageIds: string[],
  ): Promise<ReprisignResponse> {
    const doc = await this.documents.getOwnedSession(userId, documentId);
    assertPagesBelong(doc, pageIds);
    const targets = doc.pages.filter(
      (p) => pageIds.includes(p.id) && p.status === "pending",
    );
    return { documentId: doc.id, pages: await this.issueTickets(userId, doc, targets) };
  }

  async complete(
    userId: string,
    documentId: string,
    pageIds: string[],
  ): Promise<CompleteResponse> {
    const doc = await this.documents.getOwnedSession(userId, documentId);
    assertPagesBelong(doc, pageIds);
    if (doc.status === "expired") {
      throw new ConflictException("세션이 만료되었습니다.");
    }
    // 이미 확정/진행/완료면 멱등 no-op → 현재 상태 반환.
    if (doc.status !== "draft") {
      return this.buildResponse(doc, pageIds, new Map());
    }

    const requested = doc.pages.filter(
      (p) => pageIds.includes(p.id) && p.status === "pending",
    );
    const confirmations: PageConfirmation[] = [];
    const errors = new Map<string, { error: string; retryable: boolean }>();

    for (const page of requested) {
      try {
        const finalKey = await this.validateAndCopy(userId, documentId, page);
        if (finalKey) confirmations.push({ pageId: page.id, finalKey });
      } catch (e) {
        errors.set(
          page.id,
          e instanceof PageProcessError
            ? { error: e.code, retryable: e.retryable }
            : { error: "copy_failed", retryable: true },
        );
      }
    }

    const finalDoc = await this.documents.confirmPages(
      userId,
      documentId,
      confirmations,
    );

    // 확정된 임시키 정리(best-effort — 실패해도 complete 성공 유지).
    await Promise.all(
      confirmations.map((c) =>
        this.storage.delete(tmpKey(userId, documentId, c.pageId)).catch(() => {}),
      ),
    );

    return this.buildResponse(finalDoc, pageIds, errors);
  }

  // 임시키 검증(존재·크기 정확일치·매직바이트) 후 후보키로 조건부 copy. 통과 시 finalKey 반환.
  private async validateAndCopy(
    userId: string,
    documentId: string,
    page: Page,
  ): Promise<string | null> {
    const key = tmpKey(userId, documentId, page.id);
    const head = await this.storage.head(key);
    if (!head.exists) {
      throw pageError("not_uploaded", true);
    }
    if (head.size !== page.expectedSize) {
      throw pageError("size_mismatch", true);
    }
    const bytes = await this.storage.getHeadBytes(key, MAGIC_LEN);
    if (!matchesMagic(bytes, page.contentType)) {
      throw pageError("invalid_image", false);
    }
    const finalKey = candidateKey(documentId, page.id, page.revision);
    await this.storage.copy({ fromKey: key, toKey: finalKey, ifMatchETag: head.etag });
    return finalKey;
  }

  private async issueTickets(
    userId: string,
    doc: DocumentWithPages,
    pages: Page[],
  ): Promise<UploadTicket[]> {
    const expiresAt = new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString();
    return Promise.all(
      pages.map(async (p) => {
        const key = tmpKey(userId, doc.id, p.id);
        const uploadUrl = await this.storage.presignPut({
          key,
          contentType: p.contentType,
          expiresInSeconds: URL_TTL_SECONDS,
        });
        return { pageId: p.id, order: p.order, tmpKey: key, uploadUrl, expiresAt };
      }),
    );
  }

  private buildResponse(
    doc: DocumentWithPages,
    pageIds: string[],
    errors: Map<string, { error: string; retryable: boolean }>,
  ): CompleteResponse {
    const pages: PageResult[] = doc.pages
      .filter((p) => pageIds.includes(p.id))
      .map((p) => {
        if (p.status === "uploaded") return { pageId: p.id, status: "uploaded" };
        const err = errors.get(p.id);
        return {
          pageId: p.id,
          status: "pending",
          ...(err ? { error: err.error, retryable: err.retryable } : {}),
        };
      });
    return { documentId: doc.id, status: doc.status, pages };
  }
}

function tmpKey(userId: string, documentId: string, pageId: string): string {
  return `tmp/${userId}/${documentId}/${pageId}`;
}
function candidateKey(documentId: string, pageId: string, revision: number): string {
  return `documents/${documentId}/pages/${pageId}/r${revision}/${randomUUID()}`;
}

function assertPagesBelong(doc: DocumentWithPages, pageIds: string[]): void {
  if (pageIds.length === 0) {
    throw new BadRequestException("pageIds가 비어 있습니다.");
  }
  const owned = new Set(doc.pages.map((p) => p.id));
  for (const id of pageIds) {
    if (!owned.has(id)) {
      throw new BadRequestException("문서에 속하지 않는 pageId가 있습니다.");
    }
  }
}

class PageProcessError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super(code);
  }
}
function pageError(code: string, retryable: boolean): PageProcessError {
  return new PageProcessError(code, retryable);
}

// 파일 시그니처(매직바이트)로 실제 이미지 여부 최소 검증(전체 디코딩은 분석 단계 #16).
function matchesMagic(bytes: Uint8Array, contentType: string): boolean {
  const b = bytes;
  if (contentType === "image/jpeg") {
    return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
    );
  }
  if (contentType === "image/webp") {
    return (
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
    );
  }
  return false;
}
