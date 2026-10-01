import {
  analysisStatusResponseSchema,
  analyzeResponseSchema,
  type AnalysisStatusResponse,
} from "@clause-lens/contracts";
import EventSource from "react-native-sse";

import { authedGet, authedPost, baseUrl } from "../../../shared/api/client";

// 분석 API 클라이언트. 계약(@clause-lens/contracts)으로 응답을 런타임 검증.
// 토큰·URL은 로그로 남기지 않는다(guardrail). SSE 토큰은 헤더로만(쿼리 금지).

// 공유 HttpError 재노출(entitlement 등과 동일 클래스 → status 분기 일관).
export { HttpError } from "../../../shared/http";

// 분석 요청(멱등) — jobId 즉시 반환. 바디 없는 POST(Authorization만).
export async function requestAnalysis(
  accessToken: string,
  documentId: string,
): Promise<AnalysisStatusResponse> {
  return authedPost(
    `/documents/${documentId}/analyze`,
    accessToken,
    undefined,
    analyzeResponseSchema,
  );
}

// 상태 조회(진실의 기준) — 재진입·재연결 fallback.
export async function fetchStatus(
  accessToken: string,
  documentId: string,
): Promise<AnalysisStatusResponse> {
  return authedGet(
    `/documents/${documentId}/analysis`,
    accessToken,
    analysisStatusResponseSchema,
  );
}

export interface StreamHandlers {
  onStatus: (status: AnalysisStatusResponse) => void;
  onError: () => void;
}

// SSE 스트림 구독. 반환값으로 구독 해제. 토큰은 헤더로 전달(URL 쿼리 금지).
export function openStatusStream(
  accessToken: string,
  documentId: string,
  handlers: StreamHandlers,
): () => void {
  const es = new EventSource(
    `${baseUrl()}/documents/${documentId}/analysis/stream`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  es.addEventListener("message", (event) => {
    const data = event.data;
    if (!data) return; // heartbeat 등 빈 데이터 무시
    try {
      handlers.onStatus(analysisStatusResponseSchema.parse(JSON.parse(data)));
    } catch {
      // 파싱 실패는 무시(다음 이벤트/폴링 보정). 원문 로그 금지.
    }
  });
  es.addEventListener("error", () => handlers.onError());
  return () => es.close();
}
