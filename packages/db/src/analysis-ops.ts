import { coerceAnalysisErrorCode } from "@clause-lens/contracts";
import type { Box, ClauseRiskLevel } from "@clause-lens/contracts";

import { PrismaClient, Prisma } from "../generated/client";
import { settleAnalysis } from "./entitlement-ops";

// Box·위험도 유니온은 @clause-lens/contracts 단일 소스를 재노출(값·shape 불변, drift 차단, #131).
export type { Box } from "@clause-lens/contracts";
export type ClauseRisk = ClauseRiskLevel;

// 분석 파이프라인의 교차 테이블 상태 전이 — api·worker 공유 단일 소스.
// 설계: agents/intent/specs/0020-analysis-request-polling.md §③·§⑤, 0021-ocr-risk-analysis.md §③·§⑤
// 규칙: 문서 상태 전이는 여기(도메인 전이 계약)로만. worker→api import 금지를 이 함수로 대체.

// 분석 완료 결과 재열람 보관 기한(일). completedAt + 이 일수 = retainUntil.
// 정책 02 · ADR-06(무료 7일). 재열람 접근은 retainUntil로 판정(세션 TTL과 분리, 0030).
export const RETENTION_DAYS = 7;

// 큐·pub/sub 이름(api·worker 공유). 채널은 공유 Redis 대비 env prefix.
export const ANALYSIS_QUEUE = "analysis";
export function analysisChannel(prefix: string, documentId: string): string {
  return `${prefix}:analysis:${documentId}`;
}

// 종결(terminal) 상태 단일 소스 — api·worker·db 공유(값 불변, drift 차단).
// job: done·partial·failed / page: done·failed. 멱등 가드·종결 판정은 이 헬퍼로만.
export const JOB_TERMINAL_STATUSES = ["done", "partial", "failed"] as const;
export const PAGE_TERMINAL_STATUSES = ["done", "failed"] as const;
export function isJobTerminal(status: string): boolean {
  return (JOB_TERMINAL_STATUSES as readonly string[]).includes(status);
}
export function isPageTerminal(status: string): boolean {
  return (PAGE_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export type PageOutcome =
  | { pageId: string; ok: true }
  | { pageId: string; ok: false; errorCode: string; retryable: boolean };

export interface ConfirmResult {
  applied: boolean; // 이번 호출이 실제로 비종결→종결 전이를 수행했는지(멱등 판정)
  jobStatus: "queued" | "processing" | "done" | "partial" | "failed";
  documentStatus: string;
  stateVersion: number;
}

// ── OCR·분석 결과 타입 (0021) ──
// Box는 상단에서 @clause-lens/contracts 재노출.
export interface OcrBlock {
  id: string;
  text: string;
  box: Box;
  confidence?: number;
}
export interface PageOcrInput {
  pageId: string;
  revision: number;
  engine: string;
  normalizationVersion: string;
  inputFingerprint: string;
  orientation: string;
  imageWidth: number;
  imageHeight: number;
  blocks: OcrBlock[];
}
// 저장된 승자 OCR(경합 시 이 값으로 분석 진행 — 저장 OCR과 조항 근거 일치 보장, 0021 R2-3).
export interface PersistedOcr {
  imageWidth: number;
  imageHeight: number;
  orientation: string;
  blocks: OcrBlock[];
}
export interface ClauseInput {
  order: number;
  type: string;
  title: string;
  description: string;
  riskLevel: ClauseRisk;
  sourceText: string;
  boxes: Box[];
}
export interface AnalysisResultInput {
  pageId: string;
  revision: number; // 처리 스냅샷 revision(커밋 직전 재검사 기준)
  model: string;
  promptVersion: string;
  schemaVersion: string;
  clauses: ClauseInput[];
}

// Prisma 에러 코드 판별 단일 소스(api·db 공유, 코드 값 불변).
// P2002 = unique 제약 위반(동시 생성 경쟁) · P2034 = 직렬화 실패(40001, Serializable 경쟁).
export function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2002";
}
export function isSerializationFailure(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2034";
}

// 직렬화 실패(40001/P2034) 재시도 — Serializable 하에서 동시 confirm 경쟁 흡수.
async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  retries = 4,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (isSerializationFailure(e) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 10 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

// 잠금 하 전량 재집계 + job/document 전이 + stateVersion++ (성공·실패 함수 공유, 0021 R2-1).
type JobRow = { id: string; documentId: string; stateVersion: number };
async function reaggregateAndBump(
  tx: Prisma.TransactionClient,
  job: JobRow,
): Promise<{ jobStatus: ConfirmResult["jobStatus"]; documentStatus: string; stateVersion: number }> {
  const pages = await tx.pageAnalysis.findMany({ where: { jobId: job.id } });
  const total = pages.length;
  const done = pages.filter((p) => p.status === "done").length;
  const failed = pages.filter((p) => p.status === "failed").length;
  const allTerminal = total > 0 && done + failed === total;

  let jobStatus: ConfirmResult["jobStatus"];
  let documentStatus: string;
  if (allTerminal) {
    if (failed === 0) {
      jobStatus = "done";
      documentStatus = "done";
    } else if (done === 0) {
      jobStatus = "failed";
      documentStatus = "failed";
    } else {
      jobStatus = "partial";
      documentStatus = "partial";
    }
    // 무료횟수 정산(#90): done=확정 차감, 그 외=예약 해제. 전이와 같은 tx·jobId 멱등.
    await settleAnalysis(tx, job.id, jobStatus);
    // 재열람 보관 기한 설정(0030): done|partial 최초 확정 시 completedAt·retainUntil 1회.
    // `completedAt IS NULL` 가드로 중복 완료·재집계가 기한을 연장하지 못하게 한다(멱등).
    // failed는 재열람 대상이 아니므로 설정하지 않음(null 유지 → 목록·게이트에서 제외).
    if (jobStatus === "done" || jobStatus === "partial") {
      const now = new Date();
      const retainUntil = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await tx.$executeRaw`
        UPDATE "Document"
        SET "completedAt" = ${now}, "retainUntil" = ${retainUntil}
        WHERE "id" = ${job.documentId} AND "completedAt" IS NULL`;
    }
  } else {
    jobStatus = "processing";
    documentStatus = "analyzing";
  }

  const nextVersion = job.stateVersion + 1;
  await tx.analysisJob.update({
    where: { id: job.id },
    data: { status: jobStatus, stateVersion: nextVersion },
  });
  await tx.document.update({
    where: { id: job.documentId },
    data: { status: documentStatus as Prisma.DocumentUpdateInput["status"] },
  });
  return { jobStatus, documentStatus, stateVersion: nextVersion };
}

// 페이지 1개 상태 전이(실패·stale 종결 전용, 0021 R2-1).
// 성공(done)은 결과 없이 종결하지 않는다 → confirmAnalysisResultTx 사용(완료 마커 필수).
// - terminal 중복 no-op(멱등) · revision 커밋 직전 재검사(stale는 비재시도 종결)
export function confirmPageAnalysisTx(
  prisma: PrismaClient,
  args: { jobId: string; outcome: PageOutcome },
): Promise<ConfirmResult> {
  const { jobId, outcome } = args;
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const job = await tx.analysisJob.findUnique({ where: { id: jobId } });
        if (!job) throw new Error(`AnalysisJob not found: ${jobId}`);

        const noop = async (): Promise<ConfirmResult> => {
          const doc = await tx.document.findUnique({ where: { id: job.documentId } });
          return {
            applied: false,
            jobStatus: job.status,
            documentStatus: doc?.status ?? "",
            stateVersion: job.stateVersion,
          };
        };

        if (isJobTerminal(job.status)) {
          return noop();
        }

        const page = await tx.pageAnalysis.findUnique({
          where: { jobId_pageId: { jobId, pageId: outcome.pageId } },
        });
        if (!page) {
          throw new Error(`PageAnalysis not found: job=${jobId} page=${outcome.pageId}`);
        }
        if (isPageTerminal(page.status)) return noop();

        const currentPage = await tx.page.findUnique({ where: { id: outcome.pageId } });
        const stale = !currentPage || currentPage.revision !== page.revision;

        if (stale) {
          await tx.pageAnalysis.update({
            where: { id: page.id },
            data: {
              status: "failed",
              errorCode: "stale_revision",
              retryable: false,
              attempts: { increment: 1 },
              confirmedAt: new Date(),
            },
          });
        } else if (outcome.ok) {
          // 성공을 결과 없이 done 처리하는 우회 차단(0021 R2-1). 성공은 confirmAnalysisResultTx로.
          throw new Error(
            "confirmPageAnalysisTx는 실패/stale 종결 전용 — 성공은 confirmAnalysisResultTx 사용",
          );
        } else {
          await tx.pageAnalysis.update({
            where: { id: page.id },
            data: {
              status: "failed",
              // 영속 경계 가드(#133): 공개 계약 밖 코드(stub 등)는 안전 기본값으로 치환.
              errorCode: coerceAnalysisErrorCode(outcome.errorCode),
              retryable: outcome.retryable,
              attempts: { increment: 1 },
              confirmedAt: new Date(),
            },
          });
        }

        const agg = await reaggregateAndBump(tx, job);
        return { applied: true, ...agg };
      },
      { isolationLevel: "Serializable" },
    ),
  );
}

// OCR 결과를 불변 체크포인트로 저장하고 **저장된 승자 행**을 반환(0021 R2-3).
// 경합(stalled 재큐로 실행자 2개)에서도 이후 분석은 반환값(승자 블록)만 사용 → 저장 OCR과 조항 근거 일치.
export async function upsertPageOcr(
  prisma: PrismaClient,
  input: PageOcrInput,
): Promise<PersistedOcr> {
  const toPersisted = (row: {
    imageWidth: number;
    imageHeight: number;
    orientation: string;
    blocks: Prisma.JsonValue;
  }): PersistedOcr => ({
    imageWidth: row.imageWidth,
    imageHeight: row.imageHeight,
    orientation: row.orientation,
    blocks: row.blocks as unknown as OcrBlock[],
  });

  try {
    const row = await prisma.pageOcr.create({
      data: {
        pageId: input.pageId,
        revision: input.revision,
        engine: input.engine,
        normalizationVersion: input.normalizationVersion,
        inputFingerprint: input.inputFingerprint,
        orientation: input.orientation,
        imageWidth: input.imageWidth,
        imageHeight: input.imageHeight,
        blocks: input.blocks as unknown as Prisma.InputJsonValue,
      },
    });
    return toPersisted(row);
  } catch (e) {
    if (isUniqueViolation(e)) {
      // 경합 패자 → 저장된 승자 행 사용(불변).
      const existing = await prisma.pageOcr.findUnique({
        where: { pageId_revision: { pageId: input.pageId, revision: input.revision } },
      });
      if (existing) return toPersisted(existing);
    }
    throw e;
  }
}

// 분석 성공을 원자적으로 확정(0021 §③·R2-1): guard 3갈래
//  (a) terminal 중복 → no-op  (b) stale → 결과 없이 failed(stale_revision) 종결  (c) 정상 → 결과+done
// 정상: PageAnalysisResult(완료 마커) upsert + Clause 교체 + PageAnalysis done + 재집계 + stateVersion++.
export function confirmAnalysisResultTx(
  prisma: PrismaClient,
  args: { jobId: string; input: AnalysisResultInput },
): Promise<ConfirmResult> {
  const { jobId, input } = args;
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const job = await tx.analysisJob.findUnique({ where: { id: jobId } });
        if (!job) throw new Error(`AnalysisJob not found: ${jobId}`);

        const noop = async (): Promise<ConfirmResult> => {
          const doc = await tx.document.findUnique({ where: { id: job.documentId } });
          return {
            applied: false,
            jobStatus: job.status,
            documentStatus: doc?.status ?? "",
            stateVersion: job.stateVersion,
          };
        };

        // (a) job terminal → no-op(결과 쓰기 금지)
        if (isJobTerminal(job.status)) {
          return noop();
        }

        const page = await tx.pageAnalysis.findUnique({
          where: { jobId_pageId: { jobId, pageId: input.pageId } },
        });
        if (!page) {
          throw new Error(`PageAnalysis not found: job=${jobId} page=${input.pageId}`);
        }
        // (a) page terminal → no-op
        if (isPageTerminal(page.status)) return noop();

        const currentPage = await tx.page.findUnique({ where: { id: input.pageId } });
        const stale =
          !currentPage ||
          currentPage.revision !== page.revision ||
          input.revision !== page.revision;

        if (stale) {
          // (b) stale → 결과 저장 없이 종결(갇힘 방지)
          await tx.pageAnalysis.update({
            where: { id: page.id },
            data: {
              status: "failed",
              errorCode: "stale_revision",
              retryable: false,
              attempts: { increment: 1 },
              confirmedAt: new Date(),
            },
          });
        } else {
          // (c) 정상 → 완료 마커 + Clause 교체 + done (단일 tx 무결성 경계)
          const result = await tx.pageAnalysisResult.upsert({
            where: { pageId_revision: { pageId: input.pageId, revision: input.revision } },
            create: {
              pageId: input.pageId,
              revision: input.revision,
              model: input.model,
              promptVersion: input.promptVersion,
              schemaVersion: input.schemaVersion,
            },
            update: {
              model: input.model,
              promptVersion: input.promptVersion,
              schemaVersion: input.schemaVersion,
            },
          });
          await tx.clause.deleteMany({
            where: { pageId: input.pageId, revision: input.revision },
          });
          if (input.clauses.length > 0) {
            await tx.clause.createMany({
              data: input.clauses.map((c) => ({
                resultId: result.id,
                pageId: input.pageId,
                revision: input.revision,
                order: c.order,
                type: c.type,
                title: c.title,
                description: c.description,
                riskLevel: c.riskLevel,
                sourceText: c.sourceText,
                boxes: c.boxes as unknown as Prisma.InputJsonValue,
              })),
            });
          }
          await tx.pageAnalysis.update({
            where: { id: page.id },
            data: {
              status: "done",
              errorCode: null,
              retryable: false,
              attempts: { increment: 1 },
              confirmedAt: new Date(),
            },
          });
        }

        const agg = await reaggregateAndBump(tx, job);
        return { applied: true, ...agg };
      },
      { isolationLevel: "Serializable" },
    ),
  );
}
