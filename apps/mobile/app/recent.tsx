import { useRouter } from "expo-router";
import { Screen } from "@clause-lens/ui";

import { RecentListScreen } from "../src/features/documents";

// 최근 분석 전체 목록 라우트. 재열람(조항)은 결과 화면으로 이동.
export default function RecentRoute() {
  const router = useRouter();
  return (
    <Screen>
      <RecentListScreen
        onOpen={(id) => router.push({ pathname: "/result", params: { documentId: id } })}
        onBack={() => router.back()}
      />
    </Screen>
  );
}
