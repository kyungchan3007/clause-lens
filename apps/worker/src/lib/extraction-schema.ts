import { clauseRiskLevelSchema, clauseTypeSchema } from "@clause-lens/contracts";
import { z } from "zod";

// Claude 구조화 출력 검증 스키마(worker 전용 — 앱 미사용, 0021 P2 스키마 위치).
// 조항타입·위험도는 @clause-lens/contracts 단일 소스(값 불변 — drift 방지, #131).
// blockIds 최소 1개 강제(빈 근거 = 검증 실패).
export const extractionSchema = z.object({
  clauses: z.array(
    z.object({
      blockIds: z.array(z.string()).min(1),
      type: clauseTypeSchema,
      title: z.string().min(1),
      description: z.string().min(1),
      riskLevel: clauseRiskLevelSchema,
    }),
  ),
});

export type Extraction = z.infer<typeof extractionSchema>;
