import {
  entitlementResponseSchema,
  type EntitlementResponse,
} from "@clause-lens/contracts";

import { HttpError } from "../../../shared/http";

// 자격(무료 분석 잔량) API. 응답은 계약(@clause-lens/contracts)으로 런타임 검증.
// "서버가 진실의 기준" — 앱은 freeRemaining을 표시만 한다. 토큰·URL 로그 금지.

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function baseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL 누락 — apps/mobile/.env 확인");
  }
  return API_BASE_URL;
}

export async function fetchEntitlement(
  accessToken: string,
): Promise<EntitlementResponse> {
  const res = await fetch(`${baseUrl()}/me/entitlement`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(res.status);
  return entitlementResponseSchema.parse(await res.json());
}
