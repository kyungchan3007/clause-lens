import * as React from "react";
import { StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import type { Clause } from "@clause-lens/contracts";

import { boxToScreenRect, type Size } from "../lib/coordinateTransform";
import { riskPresentation } from "../lib/clausePresentation";

interface HighlightOverlayProps {
  clauses: Clause[];
  // 서버 원본(upright) 크기 — 좌표 기준.
  image: Size;
  // 실제 표시 영역(측정값).
  view: Size;
  selectedClauseId: string | null;
}

// 이미지 위에 위험조항 박스를 그리는 오버레이(react-native-svg). 이미지와 같은 wrapper·같은 view 크기를 공유.
export function HighlightOverlay({ clauses, image, view, selectedClauseId }: HighlightOverlayProps) {
  if (view.width <= 0 || view.height <= 0) return null;

  return (
    <Svg
      width={view.width}
      height={view.height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {clauses.flatMap((clause) => {
        const selected = clause.id === selectedClauseId;
        const color = riskPresentation[clause.riskLevel].accentColor;
        return clause.boxes.map((box, i) => {
          const rect = boxToScreenRect(box, image, view);
          if (!rect) return null; // 범위 밖·면적 0은 그리지 않음
          return (
            <Rect
              key={`${clause.id}-${i}`}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={2}
              stroke={color}
              strokeWidth={selected ? 3 : 1.5}
              fill={color}
              fillOpacity={selected ? 0.28 : 0.12}
            />
          );
        });
      })}
    </Svg>
  );
}
