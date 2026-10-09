import {
  analysisStatusResponseSchema,
  documentListResponseSchema,
  saveDocumentResponseSchema,
  type AnalysisStatusResponse,
  type DocumentListResponse,
  type SaveDocumentResponse,
} from "@clause-lens/contracts";

import { authedGet, authedPost } from "../../../shared/api/client";

// 분석 기록 재열람 API(0030). 응답은 계약(@clause-lens/contracts)으로 런타임 검증.
// "서버가 진실의 기준" — 앱은 보관 기한·집계를 표시만 한다. 토큰·URL 로그 금지.

// 재열람 가능한 최근 분석 문서 목록(커서 페이지네이션).
export async function fetchRecentDocuments(
  accessToken: string,
  cursor?: string,
): Promise<DocumentListResponse> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return authedGet(
    `/me/documents${qs}`,
    accessToken,
    documentListResponseSchema,
  );
}

// 문서 재열람(조항) — 기존 분석 상태 엔드포인트 재사용. 410(Gone)=보관 기간 경과.
export async function fetchDocumentReview(
  accessToken: string,
  documentId: string,
): Promise<AnalysisStatusResponse> {
  return authedGet(
    `/documents/${documentId}/analysis`,
    accessToken,
    analysisStatusResponseSchema,
  );
}

// 분석 결과 장기 보관 전환(저장하기, #163). 멱등(바디 없음).
// 거부: 403(구독 필요)·410(만료)·409(미완료) — 호출측이 HttpError.status로 분기.
export async function saveDocument(
  accessToken: string,
  documentId: string,
): Promise<SaveDocumentResponse> {
  return authedPost(
    `/me/documents/${encodeURIComponent(documentId)}/save`,
    accessToken,
    undefined,
    saveDocumentResponseSchema,
  );
}
