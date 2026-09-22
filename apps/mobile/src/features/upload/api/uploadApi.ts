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

// 업로드 API 클라이언트. 계약(@clause-lens/contracts)으로 요청·응답을 런타임 검증한다.
// 토큰·URL·이미지 원문은 로그로 남기지 않는다(guardrail).

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// HTTP 오류(스키마 오류와 구분 — 스키마 오류를 URL 재발급으로 처리하지 않기 위함).
export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}

function baseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL 누락 — apps/mobile/.env 확인");
  }
  return API_BASE_URL;
}

async function authedPost<T>(
  path: string,
  accessToken: string,
  body: unknown,
): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new HttpError(res.status);
  }
  return res.json() as Promise<T>;
}

export async function presign(
  accessToken: string,
  req: PresignRequest,
): Promise<PresignResponse> {
  // 요청도 계약으로 검증(1~20·크기·고유 order·양수 치수).
  const parsed = presignRequestSchema.parse(req);
  const res = await authedPost("/uploads/presign", accessToken, parsed);
  return presignResponseSchema.parse(res);
}

export async function reprisign(
  accessToken: string,
  documentId: string,
  pageIds: string[],
): Promise<ReprisignResponse> {
  const res = await authedPost(
    `/uploads/${documentId}/reprisign`,
    accessToken,
    { pageIds },
  );
  return reprisignResponseSchema.parse(res);
}

export async function complete(
  accessToken: string,
  documentId: string,
  pageIds: string[],
): Promise<CompleteResponse> {
  const res = await authedPost(
    `/uploads/${documentId}/complete`,
    accessToken,
    { pageIds },
  );
  return completeResponseSchema.parse(res);
}
