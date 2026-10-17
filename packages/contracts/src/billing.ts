import { z } from "zod";

// 결제 계정 연결(identify) 계약 — 앱↔API 단일 소스(#165 Slice 4A).
// "서버가 진실의 기준": 서버가 인증된 userId에서 customerId를 파생해 매핑을 멱등 생성한다.
// customerId는 클라이언트가 보낸 값이 아니라 서버가 정한다(위조 불가).
export const billingIdentifyResponseSchema = z.object({
  customerId: z.string(),
  // 이번 호출로 매핑을 새로 만들었는지(이미 있었으면 false). 멱등.
  mappingCreated: z.boolean(),
  // 최초 연결 직후 공급자 현재 상태 재동기화 결과(매핑 전 도착한 구독 흡수).
  synced: z.object({
    outcome: z.enum(["applied", "noop", "unmapped", "provider_error"]),
    applied: z.number().int().nonnegative(),
  }),
});
export type BillingIdentifyResponse = z.infer<typeof billingIdentifyResponseSchema>;
