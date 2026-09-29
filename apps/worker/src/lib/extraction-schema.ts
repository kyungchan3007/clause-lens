import { z } from "zod";

// Claude 구조화 출력 검증 스키마(worker 전용 — 앱 미사용, 0021 P2 스키마 위치).
// blockIds 최소 1개 강제(빈 근거 = 검증 실패).
export const CLAUSE_TYPES = [
  "auto_renewal",
  "penalty",
  "termination_restriction",
  "liability",
  "unilateral_change",
  "auto_payment",
  "privacy_broad",
  "jurisdiction",
  "other",
] as const;

export const extractionSchema = z.object({
  clauses: z.array(
    z.object({
      blockIds: z.array(z.string()).min(1),
      type: z.enum(CLAUSE_TYPES),
      title: z.string().min(1),
      description: z.string().min(1),
      riskLevel: z.enum(["high", "medium", "low"]),
    }),
  ),
});

export type Extraction = z.infer<typeof extractionSchema>;
