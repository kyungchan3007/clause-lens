import { useEffect, useRef } from "react";
import { Alert } from "react-native";

import { useAnalysis, useAnalysisStore } from "../../../features/analysis";
import { getAccessToken, useAuthStore } from "../../../features/auth";
import { useDraftStore } from "../../../features/capture";
import {
  useUpload,
  useUploadStore,
  type GetUploadAuth,
  type UploadPageSnapshot,
} from "../../../features/upload";
import {
  isAnalysisActive,
  isUploadActive,
  mergeSessionPhase,
  type SessionView,
} from "../lib/mergeSessionPhase";

export interface AnalysisSession {
  hasPages: boolean;
  view: SessionView;
  documentId?: string;
  actions: {
    analyze: () => void;
    cancel: () => void;
    retry: () => void;
    reset: () => void;
    confirmHome: () => void;
  };
}

// 호출 직전 토큰·소유자 취득(장기 캡처 금지).
const getAuth: GetUploadAuth = async () => {
  const token = await getAccessToken();
  const currentUserId = useAuthStore.getState().user?.id;
  return token && currentUserId ? { accessToken: token, userId: currentUserId } : null;
};

const snapshots = (): UploadPageSnapshot[] =>
  useDraftStore.getState().pages.map((p) => ({
    draftId: p.id,
    localUri: p.localUri,
    order: p.order,
    contentType: p.contentType,
    sizeBytes: p.sizeBytes,
    width: p.width,
    height: p.height,
  }));

// 홈의 업로드→분석 세션 — capture·upload·analysis·auth 교차 조합(FSD: 상위 레이어에서 조합).
export function useAnalysisSession(): AnalysisSession {
  const setLocked = useDraftStore((s) => s.setLocked);
  const clearDraft = useDraftStore((s) => s.clear);
  const hasPages = useDraftStore((s) => s.pages.length > 0);
  const userId = useAuthStore((s) => s.user?.id);

  const { start, retry: retryUpload, cancel: cancelUpload } = useUpload();
  const uploadPhase = useUploadStore((s) => s.phase);
  const sentCount = useUploadStore((s) => s.sentCount);
  const totalCount = useUploadStore((s) => s.totalCount);
  const uploadMessage = useUploadStore((s) => s.message);
  const documentId = useUploadStore((s) => s.documentId);
  const ownerUserId = useUploadStore((s) => s.ownerUserId);
  const resetUpload = useUploadStore((s) => s.reset);

  const { start: startAnalysis, cancel: cancelAnalysis } = useAnalysis();
  const analysisPhase = useAnalysisStore((s) => s.phase);
  const analysisDone = useAnalysisStore((s) => s.doneCount);
  const analysisTotal = useAnalysisStore((s) => s.totalCount);
  const analysisMessage = useAnalysisStore((s) => s.message);
  const analysisErrorKind = useAnalysisStore((s) => s.errorKind);

  const uploadActive = isUploadActive(uploadPhase);
  const active = uploadActive || uploadPhase === "uploaded" || isAnalysisActive(analysisPhase);

  // 진행 중엔 Draft 편집 잠금(스냅샷 불변성).
  useEffect(() => {
    setLocked(active);
  }, [active, setLocked]);

  // 업로드 확정 → 분석 자동 시작(문서당 1회). ref로 재시작 루프 방지.
  const startedRef = useRef<string | null>(null);
  useEffect(() => {
    if (uploadPhase === "uploaded" && documentId && startedRef.current !== documentId) {
      startedRef.current = documentId;
      void startAnalysis(documentId, getAuth);
    }
  }, [uploadPhase, documentId, startAnalysis]);

  // 계정 변경(로그아웃/전환) 시 진행 중 업로드·분석 즉시 무효화.
  useEffect(() => {
    if (active && ownerUserId && userId !== ownerUserId) {
      cancelUpload();
      cancelAnalysis();
      startedRef.current = null;
    }
  }, [active, ownerUserId, userId, cancelUpload, cancelAnalysis]);

  const analyze = (): void => {
    void start(snapshots(), getAuth);
  };

  const cancel = (): void => {
    if (uploadActive) {
      cancelUpload();
    } else {
      // 분석 단계 취소 → 세션 초기화(재시작 버튼 노출, 자동 재시작 방지).
      cancelAnalysis();
      resetUpload();
      startedRef.current = null;
    }
  };

  const retry = (): void => {
    if (uploadPhase === "error") {
      void retryUpload(snapshots(), getAuth);
    } else if (documentId) {
      startedRef.current = documentId;
      void startAnalysis(documentId, getAuth);
    }
  };

  // "새 계약서 분석"·"홈으로" — 담은 페이지·업로드·분석 세션 초기화(처음 상태로).
  const reset = (): void => {
    cancelAnalysis();
    resetUpload();
    startedRef.current = null;
    clearDraft();
  };

  // "홈으로" — 파괴적(담은 페이지·진행 분석 소실)이라 확인 후 초기화(오터치 방지).
  const confirmHome = (): void => {
    Alert.alert("홈으로 이동", "담은 페이지와 진행 중인 분석이 사라져요. 홈으로 이동할까요?", [
      { text: "취소", style: "cancel" },
      { text: "홈으로", style: "destructive", onPress: reset },
    ]);
  };

  const view = mergeSessionPhase({
    uploadPhase,
    sentCount,
    totalCount,
    uploadMessage,
    analysisPhase,
    analysisDone,
    analysisTotal,
    analysisMessage,
    analysisErrorKind,
  });

  return {
    hasPages,
    view,
    documentId,
    actions: { analyze, cancel, retry, reset, confirmHome },
  };
}
