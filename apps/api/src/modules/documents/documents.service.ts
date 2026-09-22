import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  MAX_PENDING_DOCUMENTS_PER_USER,
  type PresignPageInput,
} from "@clause-lens/contracts";

import {
  type DocumentWithPages,
  DocumentsRepository,
  type PageConfirmation,
} from "./documents.repository";

// 세션 만료(정리 기준). URL TTL과 분리.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Document/Page 상태의 소유자(공개 서비스). uploads는 이 서비스로만 상태를 바꾼다.
@Injectable()
export class DocumentsService {
  constructor(private readonly repo: DocumentsRepository) {}

  // 멱등 세션 생성/재사용. 같은 (userId, clientRequestId)=같은 세션, 다른 payload=409.
  async createOrGetSession(
    userId: string,
    clientRequestId: string,
    pages: PresignPageInput[],
  ): Promise<DocumentWithPages> {
    const existing = await this.repo.findSessionByKey(userId, clientRequestId);
    if (existing) {
      if (existing.status === "expired") {
        throw new ConflictException(
          "세션이 만료되었습니다. 새 요청으로 시작하세요.",
        );
      }
      if (!samePayload(existing, pages)) {
        throw new ConflictException(
          "같은 요청 키로 다른 내용을 보낼 수 없습니다.",
        );
      }
      return existing;
    }

    const pending = await this.repo.countPendingSessions(userId, new Date());
    if (pending >= MAX_PENDING_DOCUMENTS_PER_USER) {
      throw new ConflictException(
        "미완료 업로드 세션이 너무 많습니다. 기존 세션을 완료하거나 잠시 후 다시 시도하세요.",
      );
    }

    return this.repo.createSession(
      userId,
      clientRequestId,
      pages.map((p) => ({
        order: p.order,
        contentType: p.contentType,
        expectedSize: p.sizeBytes,
        width: p.width,
        height: p.height,
      })),
      new Date(Date.now() + SESSION_TTL_MS),
    );
  }

  async getOwnedSession(
    userId: string,
    documentId: string,
  ): Promise<DocumentWithPages> {
    const doc = await this.repo.findOwnedSession(userId, documentId);
    if (!doc) throw new NotFoundException("문서를 찾을 수 없습니다.");
    return doc;
  }

  // 검증·copy를 마친 페이지들을 원자적으로 확정(전체 uploaded일 때만 Document uploaded).
  async confirmPages(
    userId: string,
    documentId: string,
    confirmations: PageConfirmation[],
  ): Promise<DocumentWithPages> {
    const doc = await this.repo.confirmPagesTx(
      userId,
      documentId,
      confirmations,
      new Date(),
    );
    if (!doc) throw new NotFoundException("문서를 찾을 수 없습니다.");
    return doc;
  }
}

// 기존 세션의 페이지와 요청 payload가 동일한지(멱등 충돌 판정).
function samePayload(doc: DocumentWithPages, pages: PresignPageInput[]): boolean {
  if (doc.pages.length !== pages.length) return false;
  const byOrder = new Map(doc.pages.map((p) => [p.order, p]));
  return pages.every((p) => {
    const existing = byOrder.get(p.order);
    return (
      existing != null &&
      existing.contentType === p.contentType &&
      existing.expectedSize === p.sizeBytes
    );
  });
}
