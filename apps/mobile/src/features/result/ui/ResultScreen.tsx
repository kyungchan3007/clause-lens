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
import { Button, EmptyState, Icon, SectionHeader } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";
import type { Clause } from "@clause-lens/contracts";

import { isSizeConsistent, type Size } from "../lib/coordinateTransform";
import { useResultData } from "../model/useResultData";
import type { ResultScreenProps } from "../model/types";
import { ClauseList } from "./ClauseList";
import { HighlightOverlay } from "./HighlightOverlay";
import { ResultHeader } from "./ResultHeader";

// 분석 결과 화면: 헤더(닫기·페이지 네비) + 이미지 위 하이라이트 카드 + 조항 목록. 데이터·이미지 스냅샷은 app 레이어가 주입.
// 좌표 변환·상태 분리·스냅샷 매칭은 불변(0022). 이 파일은 표현(레이아웃·카드·토큰)만 담당.
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
  const showList = !failed && !incomplete && !emptyClauses;

  const goPrev = () => goToPage(Math.max(0, pageIndex - 1));
  const goNext = () => goToPage(Math.min(orderedPages.length - 1, pageIndex + 1));

  return (
    <View className="flex-1 bg-background">
      <ResultHeader
        pageIndex={pageIndex}
        total={orderedPages.length}
        onPrev={goPrev}
        onNext={goNext}
        onClose={onClose}
      />

      {image ? (
        // 바깥 카드(테두리·라운드)와 측정 대상(안쪽 뷰)을 분리 — 테두리/여백만큼 좌표가 어긋나지 않게
        // Image·SVG가 '같은 안쪽 뷰포트'를 공유하고 그 영역을 onLayout으로 측정(0022 좌표 정합 유지).
        <View className="mx-4 mt-3 overflow-hidden rounded-2xl border border-border bg-surface-alt">
          <View
            className="w-full"
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
        </View>
      ) : (
        <View className="mx-4 mt-3 rounded-2xl border border-border bg-surface-alt px-4 py-6">
          <Text className="text-center text-sm text-foreground-muted">
            원본 미리보기는 이번 세션에서만 볼 수 있어요. 아래 조항 목록으로 확인하세요.
          </Text>
        </View>
      )}

      {image && !overlayEnabled && serverSize && !imageError ? (
        <Text className="px-4 pt-2 text-center text-xs text-foreground-muted">
          이미지와 좌표가 맞지 않아 위치 표시는 건너뜁니다. 목록으로 확인하세요.
        </Text>
      ) : null}

      {showList ? (
        <SectionHeader
          variant="title"
          label="확인이 필요한 조항"
          count={clauses.length}
          hint={overlayEnabled ? "탭하면 사진에서 강조" : undefined}
          className="px-4 pb-1 pt-4"
        />
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
      >
        {failed ? (
          <Text className="px-4 pt-6 text-center text-sm text-danger">
            이 페이지 분석에 실패했어요. 새 문서로 다시 분석해 주세요.
          </Text>
        ) : incomplete ? (
          <Text className="px-4 pt-6 text-center text-sm text-foreground-muted">
            아직 결과가 준비되지 않았어요.
          </Text>
        ) : emptyClauses ? (
          <View className="flex-1 items-center justify-center px-4 py-8">
            <EmptyState
              icon="ShieldCheck"
              tone="success"
              title={"확인이 필요한 조항을\n찾지 못했어요"}
              subtitle="크게 불리한 조항은 보이지 않았어요. 다만 참고용이니 중요한 계약은 전문가 검토를 권해요."
            />
          </View>
        ) : (
          <ClauseList
            clauses={clauses}
            selectedClauseId={selectedClauseId}
            onSelect={toggleClause}
          />
        )}
      </ScrollView>

      <View className="flex-row items-start gap-2 px-5 pb-6 pt-2">
        <Icon name="Info" size={14} color={color("textMuted")} />
        <Text className="flex-1 text-xs leading-5 text-foreground-muted">
          분석 결과는 참고용이며 법률 자문을 대체하지 않아요.
        </Text>
      </View>
    </View>
  );
}
