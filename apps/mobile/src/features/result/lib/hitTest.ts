// 사진 위 색칠 구역 탭 → 조항 선택(#176). 화면 좌표(view 기준)를 박스 화면 사각형과 비교.
// coordinateTransform과 동일한 contain-fit 변환을 재사용해 그려진 박스와 정확히 일치.
import type { Clause } from "@clause-lens/contracts";

import { boxToScreenRect, type Size } from "./coordinateTransform";

export interface Point {
  x: number;
  y: number;
}

// 탭 지점이 들어간 조항 id. 겹치면 **면적 작은 박스 우선**(세밀한 조항을 먼저 선택).
// 작은 박스도 누를 수 있게 각 박스를 최소 minHitPx(44pt 권장)까지 확장(hitSlop).
export function hitTestClause(
  point: Point,
  clauses: Clause[],
  image: Size,
  view: Size,
  minHitPx = 44,
): string | null {
  let best: { id: string; area: number } | null = null;
  for (const clause of clauses) {
    for (const box of clause.boxes) {
      const rect = boxToScreenRect(box, image, view);
      if (!rect) continue;
      // 최소 히트 영역 확보 — 작은 박스는 좌우/상하로 패딩해 탭하기 쉽게.
      const padX = Math.max(0, (minHitPx - rect.width) / 2);
      const padY = Math.max(0, (minHitPx - rect.height) / 2);
      const inside =
        point.x >= rect.x - padX &&
        point.x <= rect.x + rect.width + padX &&
        point.y >= rect.y - padY &&
        point.y <= rect.y + rect.height + padY;
      if (!inside) continue;
      const area = rect.width * rect.height;
      if (!best || area < best.area) best = { id: clause.id, area };
    }
  }
  return best?.id ?? null;
}
