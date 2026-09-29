import type { Box, ClauseInput, OcrBlock } from "@clause-lens/db/analysis";

import { AnalysisPermanentError } from "./errors";
import type { ExtractedClause } from "../ports/clause-analyzer.port";

// blockIds → box 배열 + sourceText 매핑(0021 §③·R2-3·R2-7).
// - 미존재 blockId 제거, 근거가 전부 사라진 조항은 제외
// - 모델이 조항을 반환했는데 전부 무효가 되면(근거 환각) throw → analysis_failed
//   (검증 실패 0건 ≠ 정상 0건). 정상 0건은 extracted가 애초에 빈 배열.
// - 박스는 초기엔 병합하지 않고 블록별 개별 box(P2), 읽기 순서·중복 제거.
export function mapClauses(
  extracted: ExtractedClause[],
  blocks: OcrBlock[],
): ClauseInput[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const idx = new Map(blocks.map((b, i) => [b.id, i]));

  const out: ClauseInput[] = [];
  let order = 0;
  for (const c of extracted) {
    const valid = c.blockIds
      .filter((id) => byId.has(id))
      .sort((a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0));
    if (valid.length === 0) continue; // 근거 소멸 → 이 조항 무효

    const refs = valid.map((id) => byId.get(id)!);
    out.push({
      order: order++,
      type: c.type,
      title: c.title,
      description: c.description,
      riskLevel: c.riskLevel,
      sourceText: refs.map((b) => b.text).join(" "),
      boxes: dedupeBoxes(refs.map((b) => b.box)),
    });
  }

  if (extracted.length > 0 && out.length === 0) {
    // 반환된 조항이 있었으나 근거가 전부 무효 → 환각/검증 실패(정상 0건 아님).
    throw new AnalysisPermanentError("analysis_failed");
  }
  return out;
}

function dedupeBoxes(boxes: Box[]): Box[] {
  const seen = new Set<string>();
  const out: Box[] = [];
  for (const b of boxes) {
    const key = `${b.x},${b.y},${b.width},${b.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}
