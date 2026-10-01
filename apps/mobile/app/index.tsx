import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Notice } from "@clause-lens/ui";
import { BrandHeader, Hero, HowItWorks, ProcessingScreen } from "../src/features/home";
import { FreeQuotaChip, QuotaExceededScreen } from "../src/features/entitlement";
import { CaptureCTA, CaptureScreen } from "../src/features/capture";
import { RecentEntryButton } from "../src/features/documents";
import { useAnalysisSession, useHomeOnboarding } from "../src/widgets/home-session";

// 라우트는 얇게 — 세션 로직은 widgets/home-session 훅, 여기선 렌더·네비게이션만.
export default function Page() {
  const router = useRouter();
  const { hasPages, view, documentId, actions } = useAnalysisSession();
  const onboarding = useHomeOnboarding();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <BrandHeader
        onProfile={() => router.push("/profile")}
        onHome={hasPages ? actions.confirmHome : undefined}
      />
      {hasPages && view.phase === "idle" ? (
        // idle: 담은 페이지 리뷰 + 분석하기. 진행·터미널은 아래 ProcessingScreen이 소유.
        <CaptureScreen quota={<FreeQuotaChip />} analyze={{ onAnalyze: actions.analyze }} />
      ) : hasPages && view.phase === "error" && view.errorKind === "quota" ? (
        // 분석 403(무료 소진) → 전용 무료 소진 화면. 확인=idle 복귀(cancel)·남은 상태=/recent.
        <QuotaExceededScreen
          onConfirm={actions.cancel}
          onViewStatus={() => router.push("/recent")}
        />
      ) : hasPages ? (
        // active + 모든 터미널(done/partial/failed/error) → 전용 진행 화면. (view.phase !== "idle")
        <ProcessingScreen
          phase={view.phase as Exclude<typeof view.phase, "idle">}
          sentCount={view.sentCount}
          totalCount={view.totalCount}
          message={view.message}
          onCancel={actions.cancel}
          onRetry={actions.retry}
          onReset={actions.reset}
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
