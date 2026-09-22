import { Injectable } from "@nestjs/common";
import type { Document, Page } from "@clause-lens/db";

import { PrismaService } from "../../db/prisma.service";

export interface NewPageInput {
  order: number;
  contentType: string;
  expectedSize: number;
  width?: number;
  height?: number;
}
export interface PageConfirmation {
  pageId: string;
  finalKey: string;
}
export type DocumentWithPages = Document & { pages: Page[] };

// Document/Page의 유일한 Prisma 접근 지점(Service는 Prisma를 직접 만지지 않는다).
@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSessionByKey(
    userId: string,
    clientRequestId: string,
  ): Promise<DocumentWithPages | null> {
    return this.prisma.document.findUnique({
      where: { userId_clientRequestId: { userId, clientRequestId } },
      include: { pages: { orderBy: { order: "asc" } } },
    });
  }

  findOwnedSession(
    userId: string,
    documentId: string,
  ): Promise<DocumentWithPages | null> {
    return this.prisma.document.findFirst({
      where: { id: documentId, userId },
      include: { pages: { orderBy: { order: "asc" } } },
    });
  }

  countPendingSessions(userId: string, now: Date): Promise<number> {
    return this.prisma.document.count({
      where: { userId, status: "draft", expiresAt: { gt: now } },
    });
  }

  createSession(
    userId: string,
    clientRequestId: string,
    pages: NewPageInput[],
    expiresAt: Date,
  ): Promise<DocumentWithPages> {
    return this.prisma.document.create({
      data: {
        userId,
        clientRequestId,
        expiresAt,
        pages: { create: pages },
      },
      include: { pages: { orderBy: { order: "asc" } } },
    });
  }

  // 확정: 문서 단위 직렬화(Serializable)로 동시 complete 경쟁·상태 후퇴 방지.
  confirmPagesTx(
    userId: string,
    documentId: string,
    confirmations: PageConfirmation[],
    confirmedAt: Date,
  ): Promise<DocumentWithPages | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const doc = await tx.document.findFirst({
          where: { id: documentId, userId },
          include: { pages: { orderBy: { order: "asc" } } },
        });
        if (!doc) return null;
        // 후퇴 금지: draft가 아니면 상태 변경 없이 현재값 반환(멱등).
        if (doc.status !== "draft") return doc;

        const byId = new Map(confirmations.map((c) => [c.pageId, c.finalKey]));
        for (const page of doc.pages) {
          if (page.status === "pending" && byId.has(page.id)) {
            await tx.page.update({
              where: { id: page.id },
              data: {
                status: "uploaded",
                finalKey: byId.get(page.id)!,
                confirmedAt,
              },
            });
          }
        }
        const pages = await tx.page.findMany({
          where: { documentId },
          orderBy: { order: "asc" },
        });
        const allUploaded =
          pages.length > 0 && pages.every((p) => p.status === "uploaded");
        if (allUploaded) {
          await tx.document.update({
            where: { id: documentId },
            data: { status: "uploaded" },
          });
        }
        return { ...doc, status: allUploaded ? "uploaded" : doc.status, pages };
      },
      { isolationLevel: "Serializable" },
    );
  }
}
