import { useEffect, useRef } from "react";
import { Alert, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Notice } from "@clause-lens/ui";
import { BrandHeader, Hero, HowItWorks, ProcessingScreen } from "../src/features/home";
import { FreeQuotaChip, QuotaExceededScreen } from "../src/features/entitlement";

import { CaptureCTA, CaptureScreen, useDraftStore } from "../src/features/capture";
import {
  useUpload,
  useUploadStore,
  type GetUploadAuth,
  type UploadPageSnapshot,
} from "../src/features/upload";
import { useAnalysis, useAnalysisStore } from "../src/features/analysis";
import { getAccessToken, useAuthStore } from "../src/features/auth";
import { RecentEntryButton, useDocumentsStore } from "../src/features/documents";

const UPLOAD_ACTIVE = ["presigning", "uploading", "confirming"];

// 라우트는 얇게 — app 레이어에서 capture·upload·analysis·auth를 조합(FSD: 상위 레이어 조합).
export default function Page() {
  const router = useRouter();
  const setLocked = useDraftStore((s) => s.setLocked);
  const clearDraft = useDraftStore((s) => s.clear);
  const hasPages = useDraftStore((s) => s.pages.length > 0);
  const userId = useAuthStore((s) => s.user?.id);

  // 홈 4상태 계산: 담은 페이지 / 최근 0건(온보딩) / 최근 있음 / 최근 로딩·실패.
  const docStatus = useDocumentsStore((s) => s.status);
  const docCount = useDocumentsStore((s) => s.items.length);
  // 온보딩은 "최근 조회 완료 & 0건"일 때만 — 로딩·실패를 0건으로 오인하지 않는다.
  const onboarding = !hasPages && docStatus === "ready" && docCount === 0;

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
  const analysisErrorKind = useAnalysisStore((s) => s.errorKind);

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

  // done/partial에서 "새 계약서 분석" — 담은 페이지·업로드·분석 세션 초기화(처음 상태로).
  const onReset = (): void => {
    cancelAnalysis();
    resetUpload();
    startedRef.current = null;
    clearDraft();
  };

  // "홈으로" — 파괴적(담은 페이지·진행 분석 소실)이라 확인 후 초기화(오터치 방지).
  const onHome = (): void => {
    Alert.alert(
      "홈으로 이동",
      "담은 페이지와 진행 중인 분석이 사라져요. 홈으로 이동할까요?",
      [
        { text: "취소", style: "cancel" },
        { text: "홈으로", style: "destructive", onPress: onReset },
      ],
    );
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
    errorKind?: "quota";
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
        errorKind: analysisErrorKind,
      };
    }
    return { phase: "idle", sentCount: 0, totalCount: 0 };
  };

  const m = merged();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <BrandHeader
        onProfile={() => router.push("/profile")}
        onHome={hasPages ? onHome : undefined}
      />
      {hasPages && m.phase === "idle" ? (
        // idle: 담은 페이지 리뷰 + 분석하기. 진행·터미널은 아래 ProcessingScreen이 소유.
        <CaptureScreen
          quota={<FreeQuotaChip />}
          analyze={{ onAnalyze: () => void start(snapshots(), getAuth) }}
        />
      ) : hasPages && m.phase === "error" && m.errorKind === "quota" ? (
        // 분석 403(무료 소진) → 전용 무료 소진 화면. 확인=idle 복귀(onCancel)·남은 상태=/recent.
        <QuotaExceededScreen onConfirm={onCancel} onViewStatus={() => router.push("/recent")} />
      ) : hasPages ? (
        // active + 모든 터미널(done/partial/failed/error) → 전용 진행 화면. (m.phase !== "idle")
        <ProcessingScreen
          phase={m.phase as Exclude<typeof m.phase, "idle">}
          sentCount={m.sentCount}
          totalCount={m.totalCount}
          message={m.message}
          onCancel={onCancel}
          onRetry={onRetry}
          onReset={onReset}
          onViewResult={() => {
            if (documentId) {
              router.push({ pathname: "/result", params: { documentId } });
            }
          }}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-5 pb-1 pt-1">
            <FreeQuotaChip />
          </View>
          {/* Hero는 홈의 중심 — 온보딩·최근있음 모두 표시, 남는 공간 중앙에 배치. */}
          <View className="flex-1 justify-center">
            <Hero />
          </View>
          <View className="px-5 pt-3">
            <CaptureCTA />
          </View>
          {onboarding ? (
            <HowItWorks />
          ) : (
            <RecentEntryButton onSeeAll={() => router.push("/recent")} />
          )}
          <View className="px-5 pt-5">
            <Notice tone="neutral" icon="Info">
              {onboarding
                ? "분석 결과는 참고용이며 법률 자문을 대체하지 않아요."
                : "분석 결과는 7일 동안 보관돼요. 계속 보관하려면 구독이 필요해요."}
            </Notice>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
