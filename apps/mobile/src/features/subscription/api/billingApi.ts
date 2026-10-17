import {
  accessResponseSchema,
  billingIdentifyResponseSchema,
  type AccessResponse,
  type BillingIdentifyResponse,
} from "@clause-lens/contracts";

import { authedGet, authedPost } from "../../../shared/api/client";

// 결제 계정 연결·권한 조회 API(#165 Slice 4B). 응답은 계약으로 런타임 검증. 토큰·URL 로그 금지.
// identify: 매핑 멱등 생성 + 서버 재동기화 트리거. access: 현재 권한(보관·분석 잔여) — UI 갱신용.

export async function identify(accessToken: string): Promise<BillingIdentifyResponse> {
  return authedPost("/me/billing/identify", accessToken, undefined, billingIdentifyResponseSchema);
}

export async function fetchAccess(accessToken: string): Promise<AccessResponse> {
  return authedGet("/me/access", accessToken, accessResponseSchema);
}
