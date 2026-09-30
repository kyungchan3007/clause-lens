import * as React from "react";
import { useState } from "react";
import {
  Image,
  type LayoutChangeEvent,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Button } from "@clause-lens/ui";
import type { Clause } from "@clause-lens/contracts";

import { isSizeConsistent, type Size } from "../lib/coordinateTransform";
import { useResultData } from "../model/useResultData";
import type { ResultScreenProps } from "../model/types";
import { ClauseList } from "./ClauseList";
import { HighlightOverlay } from "./HighlightOverlay";

// 분석 결과 화면: 이미지 위 하이라이트 + 조항 목록. 데이터·이미지 스냅샷은 app 레이어가 주입.
export function ResultScreen({ pages, imageByPageId, onClose }: ResultScreenProps) {
  const { orderedPages, pageIndex, current, selectedClauseId, goToPage, toggleClause } =
    useResultData(pages);
  const { height } = useWindowDimensions();
  const imageAreaHeight = Math.round(height * 0.42);
  const [viewSize, setViewSize] = useState<Size>({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);

  if (!current) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background px-4">
        <Text className="text-sm text-foreground-muted">표시할 결과가 없습니다.</Text>
        {onClose ? <Button label="닫기" variant="secondary" onPress={onClose} /> : null}
      </View>
    );
  }

  const image = imageByPageId[current.pageId];
  const serverSize =
    current.imageWidth && current.imageHeight
      ? { width: current.imageWidth, height: current.imageHeight }
      : null;
  const clauses: Clause[] = current.clauses ?? [];

  // 오버레이 on: 이미지·서버크기 존재 + 로드 성공 + 로컬≈서버 크기 일치.
  const overlayEnabled =
    !!image &&
    !!serverSize &&
    !imageError &&
    isSizeConsistent(serverSize, { width: image.width, height: image.height });

  const failed = current.status === "failed";
  const incomplete = current.analysisComplete !== true || current.clauses === undefined;
  const emptyClauses = !incomplete && clauses.length === 0;

  const multi = orderedPages.length > 1;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-base font-semibold text-foreground">분석 결과</Text>
        {onClose ? <Button label="닫기" variant="ghost" onPress={onClose} /> : <View />}
      </View>

      {multi ? (
        <View className="flex-row items-center justify-center gap-4 pb-2">
          <Button
            label="이전"
            variant="secondary"
            disabled={pageIndex === 0}
            onPress={() => goToPage(Math.max(0, pageIndex - 1))}
          />
          <Text className="text-sm text-foreground-muted">
            {pageIndex + 1} / {orderedPages.length}
          </Text>
          <Button
            label="다음"
            variant="secondary"
            disabled={pageIndex === orderedPages.length - 1}
            onPress={() => goToPage(Math.min(orderedPages.length - 1, pageIndex + 1))}
          />
        </View>
      ) : null}

      {image ? (
        <View
          className="w-full bg-surface-alt"
          style={{ height: imageAreaHeight }}
          onLayout={(e: LayoutChangeEvent) =>
            setViewSize({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })
          }
        >
          <Image
            source={{ uri: image.uri }}
            resizeMode="contain"
            style={{ width: "100%", height: "100%" }}
            onError={() => setImageError(true)}
            accessibilityLabel={`${current.order + 1}페이지 분석 이미지`}
          />
          {overlayEnabled && serverSize && viewSize.width > 0 ? (
            <HighlightOverlay
              clauses={clauses}
              image={serverSize}
              view={viewSize}
              selectedClauseId={selectedClauseId}
            />
          ) : null}
        </View>
      ) : (
        <View className="mx-4 rounded-xl bg-surface-alt px-4 py-6">
          <Text className="text-center text-sm text-foreground-muted">
            원본 미리보기는 이번 세션에서만 볼 수 있어요. 아래 조항 목록으로 확인하세요.
          </Text>
        </View>
      )}

      {image && !overlayEnabled && serverSize && !imageError ? (
        <Text className="px-4 pt-1 text-center text-xs text-foreground-muted">
          이미지와 좌표가 맞지 않아 위치 표시는 건너뜁니다. 목록으로 확인하세요.
        </Text>
      ) : null}

      <ScrollView className="flex-1 pt-3" contentContainerStyle={{ paddingBottom: 32 }}>
        {failed ? (
          <Text className="px-4 text-center text-sm text-danger">
            이 페이지 분석에 실패했어요. 새 문서로 다시 분석해 주세요.
          </Text>
        ) : incomplete ? (
          <Text className="px-4 text-center text-sm text-foreground-muted">
            아직 결과가 준비되지 않았어요.
          </Text>
        ) : emptyClauses ? (
          <View className="px-4">
            <Text className="text-center text-sm text-foreground">
              이번 분석에서 확인이 필요한 조항을 찾지 못했습니다.
            </Text>
            <Text className="mt-1 text-center text-xs text-foreground-muted">
              분석 결과는 참고 정보이며 법률 자문을 대체하지 않습니다.
            </Text>
          </View>
        ) : (
          <ClauseList
            clauses={clauses}
            selectedClauseId={selectedClauseId}
            onSelect={toggleClause}
          />
        )}
      </ScrollView>
    </View>
  );
}
