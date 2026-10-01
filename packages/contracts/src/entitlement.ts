import { z } from "zod";

// 자격(무료 분석 횟수) 계약 — 앱↔API 단일 소스(타입 + 런타임 검증).
// 설계: agents/intent/specs/0027-entitlement-enforcement/
// 원칙: "서버가 진실의 기준" — 앱은 차감을 판단하지 않고 아래 값을 표시만 한다.

// 잔량 = freeGranted - freeConsumed - freeReserved (음수 방지, 0 하한).
export const entitlementResponseSchema = z.object({
  freeGranted: z.number().int().nonnegative(), // 부여된 무료 횟수(현재 3)
  freeConsumed: z.number().int().nonnegative(), // 확정 차감(done)
  freeReserved: z.number().int().nonnegative(), // 진행 중 예약
  freeRemaining: z.number().int().nonnegative(), // 가용(표시용)
});
export type EntitlementResponse = z.infer<typeof entitlementResponseSchema>;

// 가용 무료 횟수 소진으로 분석 접수가 거부될 때의 코드(앱이 로그인·구독 안내로 연결).
export const QUOTA_EXCEEDED_CODE = "quota_exceeded" as const;
