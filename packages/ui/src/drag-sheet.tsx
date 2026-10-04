import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import {
  clampIndex,
  isExpanded,
  occupyToTranslateY,
  resolveSnapIndex,
  toggleIndex,
} from "./drag-sheet.lib";

// 드래그 바텀시트(controlled). 상태 비소유 — index/onIndexChange로 소비자가 소유.
// snapPoints = 컨테이너 대비 '차지 비율' 0..1(오름차순, 1=완전 열림). 시트는 부모를 절대 채움.
// 접근성: 핸들 탭/드래그 + (소비자가 제공하는) 버튼 전환. 드래그 전용 아님(WCAG 2.2).
// 좌표 로직은 drag-sheet.lib(순수)로 분리해 단위 검증.
export interface DragSheetProps {
  index: number;
  onIndexChange: (index: number) => void;
  snapPoints: number[]; // occupy 비율 0..1 (오름차순)
  children: React.ReactNode;
  handleLabel?: string; // 핸들 a11y 라벨
}

const SPRING = { damping: 22, stiffness: 240, mass: 0.7 } as const;

export function DragSheet({
  index,
  onIndexChange,
  snapPoints,
  children,
  handleLabel = "조항 패널 열고 접기",
}: DragSheetProps) {
  const [containerH, setContainerH] = useState(0);
  const translateY = useSharedValue(0);
  const startY = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const count = snapPoints.length;

  const positions = useMemo(
    () => snapPoints.map((o) => occupyToTranslateY(o, containerH)),
    [snapPoints, containerH],
  );

  // index/레이아웃 변화 → 목표 스냅으로 이동(reduce-motion이면 점프).
  useEffect(() => {
    if (containerH <= 0 || positions.length === 0) return;
    const target = positions[clampIndex(index, count)] ?? 0;
    translateY.value = reduceMotion ? target : withSpring(target, SPRING);
  }, [index, positions, containerH, count, reduceMotion, translateY]);

  const minY = positions.length ? positions[positions.length - 1] : 0; // 가장 열림(작음)
  const maxY = positions.length ? positions[0] : 0; // 가장 접힘(큼)

  // 드래그 놓을 때 JS에서 목표 스냅 계산(resolveSnapIndex는 일반 JS — 워클릿에서 동기 호출 금지).
  const settleToSnap = (current: number, velocity: number) => {
    onIndexChange(resolveSnapIndex({ positions, current, velocity }));
  };

  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-16, 16])
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const next = startY.value + e.translationY;
      translateY.value = Math.min(Math.max(next, minY), maxY);
    })
    .onEnd((e) => {
      runOnJS(settleToSnap)(translateY.value, e.velocityY);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const onToggle = () => onIndexChange(toggleIndex(index, count));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent) => setContainerH(e.nativeEvent.layout.height)}
    >
      {containerH > 0 ? (
        <Animated.View
          style={[
            { position: "absolute", left: 0, right: 0, top: 0, height: containerH },
            styles.shadow,
            animatedStyle,
          ]}
        >
          <View className="flex-1 overflow-hidden rounded-t-3xl border-t border-border bg-background">
            <GestureDetector gesture={pan}>
              <Pressable
                onPress={onToggle}
                accessibilityRole="button"
                accessibilityLabel={handleLabel}
                accessibilityState={{ expanded: isExpanded(index, count) }}
                hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
                className="items-center pb-1 pt-2.5"
              >
                <View className="h-1.5 w-10 rounded-full bg-border" />
              </Pressable>
            </GestureDetector>
            <View className="flex-1">{children}</View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
});
