import type {
  AnalysisErrorCode,
  AnalysisStatusResponse,
} from "@clause-lens/contracts";

import type { AnalysisJobWithPages } from "../documents/documents.repository";

// DB 행(AnalysisJob + PageAnalysis + Page.order/status) → API 계약 DTO.
// 서버가 쓴 값만 담으므로 errorCode 캐스팅은 안전(클라는 zod로 재검증).
export function toStatusResponse(
  job: AnalysisJobWithPages,
): AnalysisStatusResponse {
  return {
    jobId: job.id,
    documentId: job.documentId,
    status: job.document.status,
    stateVersion: job.stateVersion,
    job: { status: job.status, totalPages: job.totalPages },
    pages: job.pages.map((pa) => ({
      pageId: pa.pageId,
      order: pa.page.order,
      status: pa.status,
      revision: pa.revision,
      errorCode: (pa.errorCode ?? undefined) as AnalysisErrorCode | undefined,
      retryable: pa.retryable,
    })),
  };
}
