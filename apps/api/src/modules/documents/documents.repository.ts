import { Injectable } from "@nestjs/common";
import type { Document, Page } from "@clause-lens/db";
import { Prisma } from "@clause-lens/db";

import { PrismaService } from "../../db/prisma.service";

// 분석 job 조회 시 문서 상태 + 페이지 order/revision(현재값)까지 포함.
const analysisInclude = {
  document: { select: { id: true, status: true } },
  pages: {
    include: { page: { select: { order: true, revision: true } } },
    orderBy: { page: { order: "asc" } },
  },
} satisfies Prisma.AnalysisJobInclude;

export type AnalysisJobWithPages = Prisma.AnalysisJobGetPayload<{
  include: typeof analysisInclude;
}>;

export interface NewAnalysisPage {
  pageId: string;
  revision: number;
}

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

  // ── 분석 (#16) ──

  // 문서의 가장 최근 분석 job(활성 or terminal). 없으면 null.
  findLatestAnalysis(documentId: string): Promise<AnalysisJobWithPages | null> {
    return this.prisma.analysisJob.findFirst({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      include: analysisInclude,
    });
  }

  // 접수: job + 페이지별 PageAnalysis 생성 + Document=analyzing (한 트랜잭션).
  // 활성 job 유일성은 부분 유니크 인덱스가 강제 → 동시 생성은 P2002.
  createAnalysisJob(
    documentId: string,
    pages: NewAnalysisPage[],
  ): Promise<AnalysisJobWithPages> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.analysisJob.create({
        data: {
          documentId,
          totalPages: pages.length,
          pages: { create: pages },
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { status: "analyzing" },
      });
      return tx.analysisJob.findUniqueOrThrow({
        where: { id: job.id },
        include: analysisInclude,
      });
    });
  }

  // 큐 전달 확인 기록(멱등).
  async markDispatched(jobId: string): Promise<void> {
    await this.prisma.analysisJob.updateMany({
      where: { id: jobId, dispatchedAt: null },
      data: { dispatchedAt: new Date() },
    });
  }

  // reconciler: 활성인데 미전달(dispatchedAt null)인 오래된 job id — 재전달 대상.
  async findUndispatchedActiveJobIds(before: Date): Promise<string[]> {
    const rows = await this.prisma.analysisJob.findMany({
      where: {
        status: { in: ["queued", "processing"] },
        dispatchedAt: null,
        createdAt: { lt: before },
      },
      select: { id: true },
      take: 100,
    });
    return rows.map((r) => r.id);
  }
}
