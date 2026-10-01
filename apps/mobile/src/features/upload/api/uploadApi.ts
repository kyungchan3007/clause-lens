import {
  completeResponseSchema,
  presignRequestSchema,
  presignResponseSchema,
  reprisignResponseSchema,
  type CompleteResponse,
  type PresignRequest,
  type PresignResponse,
  type ReprisignResponse,
} from "@clause-lens/contracts";

import { authedPost } from "../../../shared/api/client";

// 업로드 API 클라이언트. 계약(@clause-lens/contracts)으로 요청·응답을 런타임 검증한다.
// 토큰·URL·이미지 원문은 로그로 남기지 않는다(guardrail).

// HTTP 오류(스키마 오류와 구분 — 스키마 오류를 URL 재발급으로 처리하지 않기 위함).
// shared/http.ts 단일 클래스 재노출(useUpload 등 instanceof 분기가 단일 클래스로 동작).
export { HttpError } from "../../../shared/http";

export async function presign(
  accessToken: string,
  req: PresignRequest,
): Promise<PresignResponse> {
  // 요청도 계약으로 검증(1~20·크기·고유 order·양수 치수).
  const parsed = presignRequestSchema.parse(req);
  return authedPost(
    "/uploads/presign",
    accessToken,
    parsed,
    presignResponseSchema,
  );
}

export async function reprisign(
  accessToken: string,
  documentId: string,
  pageIds: string[],
): Promise<ReprisignResponse> {
  return authedPost(
    `/uploads/${documentId}/reprisign`,
    accessToken,
    { pageIds },
    reprisignResponseSchema,
  );
}

export async function complete(
  accessToken: string,
  documentId: string,
  pageIds: string[],
): Promise<CompleteResponse> {
  return authedPost(
    `/uploads/${documentId}/complete`,
    accessToken,
    { pageIds },
    completeResponseSchema,
  );
}
