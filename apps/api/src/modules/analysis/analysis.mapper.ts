import type {
  AnalysisErrorCode,
  AnalysisStatusResponse,
  Box,
  Clause,
  ClauseType,
} from "@clause-lens/contracts";

import type { AnalysisJobWithPages } from "../documents/documents.repository";

// DB 행(AnalysisJob + PageAnalysis + Page + PageOcr/Clause) → API 계약 DTO.
// 결과(치수·조항)는 정확히 (pageId, pa.revision)에 연결. 분석 완료 마커(PageAnalysisResult) 존재 = analysisComplete.
// 서버가 쓴 값만 담으므로 캐스팅은 안전(클라는 zod로 재검증).
export function toStatusResponse(
  job: AnalysisJobWithPages,
): AnalysisStatusResponse {
  return {
    jobId: job.id,
    documentId: job.documentId,
    status: job.document.status,
    stateVersion: job.stateVersion,
    job: { status: job.status, totalPages: job.totalPages },
    pages: job.pages.map((pa) => {
      const page = pa.page;
      // 정확히 이 페이지의 처리 revision에 귀속된 결과만 사용(최신 revision 오연결 방지).
      const ocr = (page.ocrResults ?? []).find((o) => o.revision === pa.revision);
      const result = (page.analysisResults ?? []).find((r) => r.revision === pa.revision);
      const clauses: Clause[] | undefined = result
        ? result.clauses.map((c) => ({
            id: c.id,
            type: c.type as ClauseType,
            title: c.title,
            description: c.description,
            riskLevel: c.riskLevel,
            sourceText: c.sourceText,
            boxes: c.boxes as unknown as Box[],
          }))
        : undefined;

      return {
        pageId: pa.pageId,
        order: page.order,
        status: pa.status,
        revision: pa.revision,
        errorCode: (pa.errorCode ?? undefined) as AnalysisErrorCode | undefined,
        retryable: pa.retryable,
        imageWidth: ocr?.imageWidth,
        imageHeight: ocr?.imageHeight,
        // 완료 마커 존재 = 분석 완료(정상 0건=true+[]; 미저장/실패=undefined).
        analysisComplete: result ? true : undefined,
        clauses,
      };
    }),
  };
}
