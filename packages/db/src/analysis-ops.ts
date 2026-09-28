import { PrismaClient, Prisma } from "../generated/client";

// 분석 파이프라인의 교차 테이블 상태 전이 — api·worker 공유 단일 소스.
// 설계: agents/intent/specs/0020-analysis-request-polling.md §③·§⑤
// 규칙: 문서 상태 전이는 여기(도메인 전이 계약)로만. worker→api import 금지를 이 함수로 대체.

// 큐·pub/sub 이름(api·worker 공유). 채널은 공유 Redis 대비 env prefix.
export const ANALYSIS_QUEUE = "analysis";
export function analysisChannel(prefix: string, documentId: string): string {
  return `${prefix}:analysis:${documentId}`;
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

// 직렬화 실패(40001) 재시도 — Serializable 하에서 동시 confirm 경쟁 흡수.
async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  retries = 4,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "P2034" && attempt < retries) {
        // write conflict / deadlock → 짧은 백오프 후 재시도
        await new Promise((r) => setTimeout(r, 10 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

// 페이지 1개 결과를 원자적으로 확정 + 문서/job 재집계 + stateVersion++.
// - revision 커밋 직전 재검사(stale는 비재시도 오류로 종결)
// - terminal 중복완료 no-op(멱등)
// - 잠금 하 재집계(증분 카운터 대신 전량 재계산 → 드리프트 없음)
export function confirmPageAnalysisTx(
  prisma: PrismaClient,
  args: { jobId: string; outcome: PageOutcome },
): Promise<ConfirmResult> {
  const { jobId, outcome } = args;
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const job = await tx.analysisJob.findUnique({ where: { id: jobId } });
        if (!job) {
          throw new Error(`AnalysisJob not found: ${jobId}`);
        }

        const snapshot = (): ConfirmResult => ({
          applied: false,
          jobStatus: job.status,
          documentStatus: "",
          stateVersion: job.stateVersion,
        });

        // job 자체가 이미 종결 → no-op(멱등)
        if (job.status === "done" || job.status === "partial" || job.status === "failed") {
          const doc = await tx.document.findUnique({ where: { id: job.documentId } });
          return { ...snapshot(), documentStatus: doc?.status ?? "" };
        }

        const page = await tx.pageAnalysis.findUnique({
          where: { jobId_pageId: { jobId, pageId: outcome.pageId } },
        });
        if (!page) {
          throw new Error(`PageAnalysis not found: job=${jobId} page=${outcome.pageId}`);
        }

        // 이 페이지가 이미 종결 → no-op(재실행 안전)
        const pageTerminal = page.status === "done" || page.status === "failed";

        if (!pageTerminal) {
          // revision 커밋 직전 재검사: 처리 대상 스냅샷과 현재 Page.revision 불일치면 stale 폐기.
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
          } else {
            await tx.pageAnalysis.update({
              where: { id: page.id },
              data: {
                status: "failed",
                errorCode: outcome.errorCode,
                retryable: outcome.retryable,
                attempts: { increment: 1 },
                confirmedAt: new Date(),
              },
            });
          }
        }

        // 잠금 하 재집계: 전체 페이지 상태로 job·document 종합.
        const pages = await tx.pageAnalysis.findMany({ where: { jobId } });
        const total = pages.length;
        const done = pages.filter((p) => p.status === "done").length;
        const failed = pages.filter((p) => p.status === "failed").length;
        const terminalCount = done + failed;
        const allTerminal = total > 0 && terminalCount === total;

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
          // 무료횟수 차감 훅 지점(완료·부분실패). 실차감·예약은 TASK-005 — 여기선 전이만.
        } else {
          jobStatus = "processing";
          documentStatus = "analyzing";
        }

        const applied = !pageTerminal; // 이번에 실제 페이지 전이를 수행했는지

        const nextVersion = job.stateVersion + 1;
        await tx.analysisJob.update({
          where: { id: jobId },
          data: { status: jobStatus, stateVersion: nextVersion },
        });
        await tx.document.update({
          where: { id: job.documentId },
          data: { status: documentStatus as Prisma.DocumentUpdateInput["status"] },
        });

        return { applied, jobStatus, documentStatus, stateVersion: nextVersion };
      },
      { isolationLevel: "Serializable" },
    ),
  );
}
