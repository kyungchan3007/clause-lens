import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { RecentListScreen } from "../src/features/documents";

// 최근 분석 전체 목록 라우트. 재열람(조항)은 결과 화면으로 이동.
export default function RecentRoute() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <RecentListScreen
        onOpen={(id) => router.push({ pathname: "/result", params: { documentId: id } })}
        onBack={() => router.back()}
      />
    </SafeAreaView>
  );
}
