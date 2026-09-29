import type { OcrBlock } from "@clause-lens/db/analysis";

import { mapClauses } from "./box-mapper";
import { AnalysisPermanentError } from "./errors";
import type { ExtractedClause } from "../ports/clause-analyzer.port";

const blocks: OcrBlock[] = [
  { id: "b0", text: "제1조", box: { x: 0, y: 0, width: 10, height: 5 } },
  { id: "b1", text: "자동 갱신", box: { x: 0, y: 10, width: 20, height: 5 } },
  { id: "b2", text: "위약금", box: { x: 0, y: 20, width: 15, height: 5 } },
];

function clause(blockIds: string[]): ExtractedClause {
  return { blockIds, type: "auto_renewal", title: "t", description: "d", riskLevel: "high" };
}

describe("mapClauses", () => {
  it("blockIds → box 배열 + sourceText(읽기순) 매핑", () => {
    const out = mapClauses([clause(["b1", "b2"])], blocks);
    expect(out).toHaveLength(1);
    expect(out[0].boxes).toEqual([
      { x: 0, y: 10, width: 20, height: 5 },
      { x: 0, y: 20, width: 15, height: 5 },
    ]);
    expect(out[0].sourceText).toBe("자동 갱신 위약금");
    expect(out[0].order).toBe(0);
  });

  it("존재하지 않는 blockId는 제거하고 유효한 근거만 사용", () => {
    const out = mapClauses([clause(["b1", "ghost"])], blocks);
    expect(out[0].boxes).toEqual([{ x: 0, y: 10, width: 20, height: 5 }]);
  });

  it("근거가 전부 무효인 조항은 제외", () => {
    // 두 조항 중 하나만 유효 → 유효한 것만 남음(전체가 무효는 아님)
    const out = mapClauses([clause(["ghost"]), clause(["b0"])], blocks);
    expect(out).toHaveLength(1);
    expect(out[0].sourceText).toBe("제1조");
  });

  it("정상 0건(빈 추출)은 빈 배열 반환(throw 안 함)", () => {
    expect(mapClauses([], blocks)).toEqual([]);
  });

  it("반환 조항이 있으나 근거가 전부 무효 → analysis_failed (검증 실패 ≠ 정상 0건)", () => {
    expect(() => mapClauses([clause(["ghost1"]), clause(["ghost2"])], blocks)).toThrow(
      AnalysisPermanentError,
    );
  });

  it("중복 box는 제거", () => {
    const dup: OcrBlock[] = [
      { id: "b0", text: "a", box: { x: 1, y: 1, width: 2, height: 2 } },
      { id: "b1", text: "b", box: { x: 1, y: 1, width: 2, height: 2 } },
    ];
    const out = mapClauses([clause(["b0", "b1"])], dup);
    expect(out[0].boxes).toHaveLength(1);
  });
});
