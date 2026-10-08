import * as React from "react";
import { useCallback, useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  Canvas,
  Image as SkiaImage,
  RoundedRect,
  useImage,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import type { Clause } from "@clause-lens/contracts";

import { boxToScreenRect, computeContainFit, type Size } from "../lib/coordinateTransform";
import { riskPresentation } from "../lib/clausePresentation";
import { hitTestClause } from "../lib/hitTest";

interface SkiaHighlightCanvasProps {
  // 서버 정규화(upright) 이미지 URL — boxes와 동일 픽셀 공간(#175).
  url: string;
  clauses: Clause[];
  image: Size; // 좌표 기준(normalizedImage.width/height)
  view: Size; // 실제 표시 영역(측정값)
  selectedClauseId: string | null;
  onSelectClause: (id: string) => void;
}

// 이미지 + 위험조항 색칠을 한 Skia 캔버스에 그리고, 구역 탭으로 조항을 선택한다(#176).
// 좌표 변환·그리기 로직은 기존 SVG(HighlightOverlay)와 동일(coordinateTransform 재사용) — 표현 레이어만 Skia.
export function SkiaHighlightCanvas({
  url,
  clauses,
  image,
  view,
  selectedClauseId,
  onSelectClause,
}: SkiaHighlightCanvasProps) {
  const skImage = useImage(url);
  const fit = computeContainFit(image, view);

  // 탭 히트테스트는 순수함수(JS 스레드)에서 — 워클릿에서 runOnJS로 넘긴다.
  const handleTap = useCallback(
    (x: number, y: number) => {
      const id = hitTestClause({ x, y }, clauses, image, view);
      if (id) onSelectClause(id);
    },
    [clauses, image, view, onSelectClause],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap().onEnd((e) => {
        "worklet";
        runOnJS(handleTap)(e.x, e.y);
      }),
    [handleTap],
  );

  if (view.width <= 0 || view.height <= 0 || !fit) return null;

  return (
    <GestureDetector gesture={tap}>
      <Canvas style={StyleSheet.absoluteFill}>
        {skImage ? (
          <SkiaImage
            image={skImage}
            x={fit.offsetX}
            y={fit.offsetY}
            width={fit.displayWidth}
            height={fit.displayHeight}
            fit="fill"
          />
        ) : null}
        {skImage
          ? clauses.flatMap((clause) => {
              const selected = clause.id === selectedClauseId;
              const color = riskPresentation[clause.riskLevel].accentColor;
              return clause.boxes.map((box, i) => {
                const rect = boxToScreenRect(box, image, view);
                if (!rect) return null; // 범위 밖·면적 0은 그리지 않음
                return (
                  <React.Fragment key={`${clause.id}-${i}`}>
                    <RoundedRect
                      x={rect.x}
                      y={rect.y}
                      width={rect.width}
                      height={rect.height}
                      r={3}
                      color={color}
                      opacity={selected ? 0.28 : 0.14}
                    />
                    <RoundedRect
                      x={rect.x}
                      y={rect.y}
                      width={rect.width}
                      height={rect.height}
                      r={3}
                      color={color}
                      style="stroke"
                      strokeWidth={selected ? 3 : 1.5}
                      opacity={selected ? 1 : 0.6}
                    />
                  </React.Fragment>
                );
              });
            })
          : null}
      </Canvas>
    </GestureDetector>
  );
}
