import {
  entitlementResponseSchema,
  type EntitlementResponse,
} from "@clause-lens/contracts";

import { authedGet } from "../../../shared/api/client";

// 자격(무료 분석 잔량) API. 응답은 계약(@clause-lens/contracts)으로 런타임 검증.
// "서버가 진실의 기준" — 앱은 freeRemaining을 표시만 한다. 토큰·URL 로그 금지.

export async function fetchEntitlement(
  accessToken: string,
): Promise<EntitlementResponse> {
  return authedGet("/me/entitlement", accessToken, entitlementResponseSchema);
}
