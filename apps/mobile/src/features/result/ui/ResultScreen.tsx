import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Image,
  type LayoutChangeEvent,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Button, DragSheet, EmptyState, Icon, SectionHeader } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";
import type { Clause } from "@clause-lens/contracts";

import { isSizeConsistent, type Size } from "../lib/coordinateTransform";
import {
  computeCollapsedOccupy,
  handleBackPress,
  SHEET_COLLAPSED,
  SHEET_FULL,
  shouldCollapseOnClauseTap,
} from "../lib/sheet";
import { useResultData } from "../model/useResultData";
import type { ResultScreenProps } from "../model/types";
import { ClauseList } from "./ClauseList";
import { HighlightOverlay } from "./HighlightOverlay";
import { ResultHeader } from "./ResultHeader";

// 분석 결과 화면: 헤더 + 이미지 하이라이트 카드 + 조항 목록(전체 보기 드래그 바텀시트).
// 좌표 변환·상태 분리·스냅샷 매칭은 불변(0022). 시트는 이미지와 독립된 오버레이 — 좌표 측정 불변(0063).
export function ResultScreen({ pages, imageByPageId, onClose }: ResultScreenProps) {
  const { orderedPages, pageIndex, current, selectedClauseId, goToPage, toggleClause } =
    useResultData(pages);
  const { height } = useWindowDimensions();
  const imageAreaHeight = Math.round(height * 0.42);
  const [viewSize, setViewSize] = useState<Size>({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [snapIndex, setSnapIndex] = useState(SHEET_COLLAPSED);

  const image = current ? imageByPageId[current.pageId] : undefined;
  const serverSize =
    current && current.imageWidth && current.imageHeight
      ? { width: current.imageWidth, height: current.imageHeight }
      : null;
  const clauses: Clause[] = current?.clauses ?? [];

  const overlayEnabled =
    !!image &&
    !!serverSize &&
    !imageError &&
    isSizeConsistent(serverSize, { width: image.width, height: image.height });

  const failed = current?.status === "failed";
  const incomplete = current?.analysisComplete !== true || current?.clauses === undefined;
  const emptyClauses = !incomplete && clauses.length === 0;
  const showList = !!current && !failed && !incomplete && !emptyClauses;

  // 페이지 전환 시 시트는 접힘으로 초기화(선택 해제는 useResultData가 처리).
  const pageId = current?.pageId;
  useEffect(() => {
    setSnapIndex(SHEET_COLLAPSED);
  }, [pageId]);

  // Android 뒤로가기: full이면 collapsed로(소비), 아니면 기본.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () =>
      handleBackPress({
        showSheet: showList,
        snapIndex,
        collapse: () => setSnapIndex(SHEET_COLLAPSED),
      }),
    );
    return () => sub.remove();
  }, [showList, snapIndex]);

  const imageCardHeight = image ? imageAreaHeight + 14 : 96;
  const collapsedOccupy = computeCollapsedOccupy({ contentHeight: contentH, imageCardHeight });
  const snapPoints = useMemo(() => [collapsedOccupy, 1], [collapsedOccupy]);

  const onClauseTap = (id: string) => {
    toggleClause(id);
    if (shouldCollapseOnClauseTap({ snapIndex, overlayEnabled })) {
      setSnapIndex(SHEET_COLLAPSED);
    }
  };

  if (!current) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background px-4">
        <Text className="text-sm text-foreground-muted">표시할 결과가 없습니다.</Text>
        {onClose ? <Button label="닫기" variant="secondary" onPress={onClose} /> : null}
      </View>
    );
  }

  const goPrev = () => goToPage(Math.max(0, pageIndex - 1));
  const goNext = () => goToPage(Math.min(orderedPages.length - 1, pageIndex + 1));

  const imageBlock = image ? (
    // 바깥 카드(테두리·라운드)와 측정 대상(안쪽 뷰) 분리 — Image·SVG가 같은 내부 viewport 공유(좌표 정합).
    <View className="mx-4 mt-3 overflow-hidden rounded-2xl border border-border bg-surface-alt">
      <View
        className="w-full"
        style={{ height: imageAreaHeight }}
        onLayout={(e: LayoutChangeEvent) =>
          setViewSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
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
  );

  const mismatchNotice =
    image && !overlayEnabled && serverSize && !imageError ? (
      <Text className="px-4 pt-2 text-center text-xs text-foreground-muted">
        이미지와 좌표가 맞지 않아 위치 표시는 건너뜁니다. 목록으로 확인하세요.
      </Text>
    ) : null;

  const footer = (
    <View className="flex-row items-start gap-2 px-5 pb-6 pt-2">
      <Icon name="Info" size={14} color={color("textMuted")} />
      <Text className="flex-1 text-xs leading-5 text-foreground-muted">
        분석 결과는 참고용이며 법률 자문을 대체하지 않아요.
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <ResultHeader
        pageIndex={pageIndex}
        total={orderedPages.length}
        onPrev={goPrev}
        onNext={goNext}
        onClose={onClose}
      />

      <View
        className="flex-1 overflow-hidden"
        onLayout={(e: LayoutChangeEvent) => setContentH(e.nativeEvent.layout.height)}
      >
        {imageBlock}
        {mismatchNotice}

        {showList ? (
          <DragSheet
            index={snapIndex}
            onIndexChange={setSnapIndex}
            snapPoints={snapPoints}
            handleLabel={snapIndex === SHEET_FULL ? "조항 접기" : "조항 전체 보기"}
          >
            <SectionHeader
              variant="title"
              label="확인이 필요한 조항"
              count={clauses.length}
              action={{
                label: snapIndex === SHEET_FULL ? "접기" : "전체 보기",
                onPress: () =>
                  setSnapIndex(snapIndex === SHEET_FULL ? SHEET_COLLAPSED : SHEET_FULL),
              }}
              className="px-4 pb-1 pt-1"
            />
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <ClauseList
                clauses={clauses}
                selectedClauseId={selectedClauseId}
                onSelect={onClauseTap}
              />
            </ScrollView>
          </DragSheet>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
            {failed ? (
              <Text className="px-4 pt-6 text-center text-sm text-danger">
                이 페이지 분석에 실패했어요. 새 문서로 다시 분석해 주세요.
              </Text>
            ) : incomplete ? (
              <Text className="px-4 pt-6 text-center text-sm text-foreground-muted">
                아직 결과가 준비되지 않았어요.
              </Text>
            ) : (
              <View className="flex-1 items-center justify-center px-4 py-8">
                <EmptyState
                  icon="ShieldCheck"
                  tone="success"
                  title={"확인이 필요한 조항을\n찾지 못했어요"}
                  subtitle="크게 불리한 조항은 보이지 않았어요. 다만 참고용이니 중요한 계약은 전문가 검토를 권해요."
                />
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {footer}
    </View>
  );
}
