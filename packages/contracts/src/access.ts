import { z } from "zod";

// 접근 권한 계약(TASK-006 #162) — 앱↔API 단일 소스. "서버가 진실의 기준".
// 보관 가능 여부 + 분석 잔여(구독이면 월 쿼터, 아니면 무료)를 서버가 판정해 돌려준다.
export const accessResponseSchema = z.object({
  // 장기 보관(저장) 권한 — 유효 구독(active|grace)이면 true.
  storage: z.object({ canSave: z.boolean() }),
  // 분석 잔여 — source=subscription이면 월 쿼터, free면 무료 잔량.
  analysis: z.object({
    source: z.enum(["free", "subscription"]),
    remaining: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative(), // 월 쿼터(구독) 또는 무료 부여량
  }),
});
export type AccessResponse = z.infer<typeof accessResponseSchema>;
