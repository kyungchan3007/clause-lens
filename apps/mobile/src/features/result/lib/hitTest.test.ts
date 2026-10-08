import type { Clause } from "@clause-lens/contracts";

import { hitTestClause } from "./hitTest";

// image 1000x1400 → view 500x700: scale 0.5, offset 0 (같은 비율). 화면 = 원본 * 0.5.
const IMAGE = { width: 1000, height: 1400 };
const VIEW = { width: 500, height: 700 };

function clause(id: string, boxes: { x: number; y: number; width: number; height: number }[]): Clause {
  return {
    id,
    type: "other",
    title: id,
    description: "",
    riskLevel: "low",
    sourceText: "",
    boxes,
  } as Clause;
}

describe("hitTestClause (#176)", () => {
  it("박스 안을 탭하면 해당 조항", () => {
    const a = clause("a", [{ x: 100, y: 100, width: 200, height: 40 }]); // 화면 {50,50,100,20}
    expect(hitTestClause({ x: 60, y: 55 }, [a], IMAGE, VIEW)).toBe("a");
  });

  it("범위 밖은 null", () => {
    const a = clause("a", [{ x: 100, y: 100, width: 200, height: 40 }]);
    expect(hitTestClause({ x: 400, y: 400 }, [a], IMAGE, VIEW)).toBeNull();
  });

  it("겹치면 면적 작은 박스 우선", () => {
    const small = clause("small", [{ x: 100, y: 100, width: 200, height: 40 }]); // 화면 area 100*20=2000
    const big = clause("big", [{ x: 100, y: 100, width: 600, height: 600 }]); // 화면 area 300*300
    // (60,55)는 둘 다 포함 → 작은 'small'
    expect(hitTestClause({ x: 60, y: 55 }, [big, small], IMAGE, VIEW)).toBe("small");
  });

  it("작은 박스도 44pt 최소 히트로 가장자리 탭 허용", () => {
    const tiny = clause("tiny", [{ x: 800, y: 1300, width: 10, height: 10 }]); // 화면 {400,650,5,5}
    // 5x5 박스 밖이지만 44pt 패딩 안 → 선택됨
    expect(hitTestClause({ x: 410, y: 655 }, [tiny], IMAGE, VIEW)).toBe("tiny");
    // 패딩보다도 멀면 null
    expect(hitTestClause({ x: 460, y: 655 }, [tiny], IMAGE, VIEW)).toBeNull();
  });

  it("빈 조항·빈 박스는 null", () => {
    expect(hitTestClause({ x: 10, y: 10 }, [], IMAGE, VIEW)).toBeNull();
  });
});
