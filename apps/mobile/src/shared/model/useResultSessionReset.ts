import { useEffect, useRef } from "react";

import { useAnalysisStore } from "../../features/analysis";
import { useAuthStore } from "../../features/auth";
import { useUploadStore } from "../../features/upload";

// 결과 세션 격리(#76) — 로그아웃·계정 변경 시 analysis·upload 메모리를 리셋한다.
//
// 역할 분리: 교차 사용자 노출 차단은 가시성 스탬프(canUseAnalysisSnapshot = userId===analysisOwner)가
// 매 판정(렌더 전)에서 담당한다. 이 훅은 그 보조로, 세션 경계에서 민감 메모리(이전 분석·업로드
// 스냅샷·이미지)를 제거하고 진행 중 run을 무효화(reset → 다음 start의 bumpRunWith가 세대 증가)한다.
//
// userId 전이 하나로 세 경로를 모두 감지한다: A→B(계정 변경)·A→null(로그아웃)·
// onAuthLost(#126, status→unauthenticated=userId null). 최초 마운트는 리셋하지 않는다(빈 스토어).
export function useResultSessionReset(): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const seenRef = useRef(false);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (seenRef.current && prevRef.current !== userId) {
      useAnalysisStore.getState().reset();
      useUploadStore.getState().reset();
    }
    seenRef.current = true;
    prevRef.current = userId;
  }, [userId]);
}
