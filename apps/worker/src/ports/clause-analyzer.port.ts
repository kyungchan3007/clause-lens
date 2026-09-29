// 위험조항 분석 공급자 경계(포트). 구현 = Claude(실) / Stub(개발·단위).
// 의미 판단만 담당 — 좌표는 만들지 않고 근거 blockIds만 반환(worker가 box 매핑).

export interface AnalyzerBlock {
  id: string;
  text: string;
}

export interface ExtractedClause {
  blockIds: string[]; // 근거 블록 id(실제 존재만, worker가 재검증)
  type: string;
  title: string;
  description: string;
  riskLevel: "high" | "medium" | "low";
}

export interface AnalyzerResult {
  clauses: ExtractedClause[];
  model: string; // 실제 사용 모델 id(provenance)
}

export abstract class ClauseAnalyzerPort {
  abstract analyze(blocks: AnalyzerBlock[]): Promise<AnalyzerResult>;
}
