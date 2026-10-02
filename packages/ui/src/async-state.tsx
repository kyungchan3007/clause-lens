import * as React from "react";
import { ActivityIndicator, Pressable, type PressableProps, Text } from "react-native";

// 비동기 상태(로딩·에러-재시도)의 인라인 표현 전용 컴포넌트.
// 데이터/스토어 구독은 호출부가 소유하고, 여기선 "어떻게 보일지"만 공통화한다(표시 전용).
// 레이아웃 차이(컨테이너·테두리·정렬)는 호출부가 바깥 View로, 미세 차이는 props로 흡수한다.

export interface LoadingIndicatorProps {
  // 스크린리더 라벨 — 필수(스피너는 라벨 없으면 접근성 미표시).
  label: string;
  // ActivityIndicator 크기(기본 "small").
  size?: "small" | "large";
}

// 로딩 스피너 + 접근성 라벨. ActivityIndicator 1:1 래퍼로 "라벨 필수" 규칙만 강제.
export function LoadingIndicator({ label, size }: LoadingIndicatorProps) {
  return <ActivityIndicator size={size} accessibilityLabel={label} />;
}

export interface RetryInlineProps {
  // 재시도 onPress(스토어 refresh 등은 호출부가 바인딩).
  onRetry: () => void;
  // 기본 danger 텍스트 내용(children 지정 시 접근성 라벨 용도로만 쓰임).
  label: string;
  // Pressable 컨테이너 클래스 — 카드·filled·self-start 등 레이아웃 차이 흡수.
  className?: string;
  // 기본 텍스트 클래스 오버라이드(기본: "text-sm text-danger").
  textClassName?: string;
  // Pressable 접근성 라벨(미지정 시 자식 텍스트가 접근명 제공).
  accessibilityLabel?: string;
  hitSlop?: PressableProps["hitSlop"];
  // 지정 시 기본 danger 텍스트 대신 렌더(예: Badge).
  children?: React.ReactNode;
}

// 에러 상태 재시도 컨트롤 — accessibilityRole="button" Pressable + danger 텍스트(또는 children).
export function RetryInline({
  onRetry,
  label,
  className,
  textClassName,
  accessibilityLabel,
  hitSlop,
  children,
}: RetryInlineProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onRetry}
      hitSlop={hitSlop}
      className={className}
    >
      {children ?? <Text className={textClassName ?? "text-sm text-danger"}>{label}</Text>}
    </Pressable>
  );
}
