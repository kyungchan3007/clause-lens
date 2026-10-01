import {
  analysisStatusResponseSchema,
  documentListResponseSchema,
  type AnalysisStatusResponse,
  type DocumentListResponse,
} from "@clause-lens/contracts";

import { HttpError } from "../../../shared/http";

// 분석 기록 재열람 API(0030). 응답은 계약(@clause-lens/contracts)으로 런타임 검증.
// "서버가 진실의 기준" — 앱은 보관 기한·집계를 표시만 한다. 토큰·URL 로그 금지.

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function baseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL 누락 — apps/mobile/.env 확인");
  }
  return API_BASE_URL;
}

// 재열람 가능한 최근 분석 문서 목록(커서 페이지네이션).
export async function fetchRecentDocuments(
  accessToken: string,
  cursor?: string,
): Promise<DocumentListResponse> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const res = await fetch(`${baseUrl()}/me/documents${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(res.status);
  return documentListResponseSchema.parse(await res.json());
}

// 문서 재열람(조항) — 기존 분석 상태 엔드포인트 재사용. 410(Gone)=보관 기간 경과.
export async function fetchDocumentReview(
  accessToken: string,
  documentId: string,
): Promise<AnalysisStatusResponse> {
  const res = await fetch(`${baseUrl()}/documents/${documentId}/analysis`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(res.status);
  return analysisStatusResponseSchema.parse(await res.json());
}
