import { Injectable } from "@nestjs/common";

import { AnalysisPermanentError, AnalysisTransientError } from "../lib/errors";
import {
  ClauseAnalyzerPort,
  type AnalyzerBlock,
  type AnalyzerResult,
} from "../ports/clause-analyzer.port";

// 실제 Claude 없이 파이프라인을 개발·단위 검증하는 stub. 결정적(env 제어).
//   STUB_ANALYZER_MODE  success(기본) | empty | permanent | transient
@Injectable()
export class StubClauseAnalyzer extends ClauseAnalyzerPort {
  async analyze(blocks: AnalyzerBlock[]): Promise<AnalyzerResult> {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.STUB_OCR_ALLOW_PROD !== "1"
    ) {
      throw new AnalysisPermanentError("stub_disabled_in_production");
    }
    const mode = process.env.STUB_ANALYZER_MODE ?? "success";
    if (mode === "permanent") throw new AnalysisPermanentError("analysis_failed");
    if (mode === "transient") throw new AnalysisTransientError("analysis_timeout");
    if (mode === "empty" || blocks.length === 0) return { clauses: [], model: "stub" };

    return {
      clauses: [
        {
          blockIds: [blocks[0].id],
          type: "auto_renewal",
          title: "자동 연장",
          description: "통보하지 않으면 자동으로 갱신됩니다. 확인이 필요합니다.",
          riskLevel: "high",
        },
      ],
      model: "stub",
    };
  }
}
