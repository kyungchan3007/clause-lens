import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@clause-lens/ui";
import { semantic } from "@clause-lens/tokens";

import { CaptureScreen, useDraftStore } from "../src/features/capture";
import {
  useUpload,
  useUploadStore,
  type GetUploadAuth,
  type UploadPageSnapshot,
} from "../src/features/upload";
import { useAnalysis, useAnalysisStore } from "../src/features/analysis";
import { getAccessToken, useAuthStore } from "../src/features/auth";

const UPLOAD_ACTIVE = ["presigning", "uploading", "confirming"];

// 라우트는 얇게 — app 레이어에서 capture·upload·analysis·auth를 조합(FSD: 상위 레이어 조합).
export default function Page() {
  const router = useRouter();
  const setLocked = useDraftStore((s) => s.setLocked);
  const userId = useAuthStore((s) => s.user?.id);

  const { start, retry, cancel } = useUpload();
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

  const uploadActive = UPLOAD_ACTIVE.includes(uploadPhase);
  const analysisActive = ["requesting", "analyzing"].includes(analysisPhase);
  const active = uploadActive || uploadPhase === "uploaded" || analysisActive;

  // 진행 중엔 Draft 편집 잠금(스냅샷 불변성).
  useEffect(() => {
    setLocked(active);
  }, [active, setLocked]);

  // 호출 직전 토큰·소유자 취득(장기 캡처 금지).
  const getAuth: GetUploadAuth = async () => {
    const token = await getAccessToken();
    const currentUserId = useAuthStore.getState().user?.id;
    return token && currentUserId
      ? { accessToken: token, userId: currentUserId }
      : null;
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

  // 업로드 확정 → 분석 자동 시작(문서당 1회). ref로 재시작 루프 방지.
  const startedRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      uploadPhase === "uploaded" &&
      documentId &&
      startedRef.current !== documentId
    ) {
      startedRef.current = documentId;
      void startAnalysis(documentId, getAuth);
    }
    // getAuth는 매 렌더 새로 생성되나 부수효과 트리거는 phase·documentId로 충분.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadPhase, documentId, startAnalysis]);

  // 계정 변경(로그아웃/전환) 시 진행 중 업로드·분석 즉시 무효화.
  useEffect(() => {
    if (active && ownerUserId && userId !== ownerUserId) {
      cancel();
      cancelAnalysis();
      startedRef.current = null;
    }
  }, [active, ownerUserId, userId, cancel, cancelAnalysis]);

  const onCancel = (): void => {
    if (uploadActive) {
      cancel();
    } else {
      // 분석 단계 취소 → 세션 초기화(재시작 버튼 노출, 자동 재시작 방지).
      cancelAnalysis();
      resetUpload();
      startedRef.current = null;
    }
  };

  const onRetry = (): void => {
    if (uploadPhase === "error") {
      void retry(snapshots(), getAuth);
    } else if (documentId) {
      startedRef.current = documentId;
      void startAnalysis(documentId, getAuth);
    }
  };

  // 업로드+분석을 하나의 표시 상태로 병합.
  const merged = (): {
    phase:
      | "idle"
      | "presigning"
      | "uploading"
      | "confirming"
      | "uploaded"
      | "requesting"
      | "analyzing"
      | "done"
      | "partial"
      | "failed"
      | "error";
    sentCount: number;
    totalCount: number;
    message?: string;
  } => {
    if (uploadPhase === "error") {
      return { phase: "error", sentCount, totalCount, message: uploadMessage };
    }
    if (uploadActive) {
      return {
        phase: uploadPhase,
        sentCount,
        totalCount,
        message: uploadMessage,
      };
    }
    if (uploadPhase === "uploaded") {
      if (analysisPhase === "idle") {
        return { phase: "uploaded", sentCount, totalCount };
      }
      return {
        phase: analysisPhase,
        sentCount: analysisDone,
        totalCount: analysisTotal,
        message: analysisMessage,
      };
    }
    return { phase: "idle", sentCount: 0, totalCount: 0 };
  };

  const m = merged();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-end px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="마이페이지"
          onPress={() => router.push("/profile")}
          hitSlop={12}
          className="p-1 active:opacity-60"
        >
          <Icon name="User" size={24} color={semantic.light.text} />
        </Pressable>
      </View>
      <CaptureScreen
        analyze={{
          phase: m.phase,
          sentCount: m.sentCount,
          totalCount: m.totalCount,
          message: m.message,
          onAnalyze: () => void start(snapshots(), getAuth),
          onRetry,
          onCancel,
        }}
      />
    </SafeAreaView>
  );
}
