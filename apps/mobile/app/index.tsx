import { SafeAreaView } from "react-native-safe-area-context";
import { CaptureScreen } from "../src/features/capture";

// 라우트는 얇게 — 화면만 렌더 (FSD: app 레이어)
export default function Page() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <CaptureScreen />
    </SafeAreaView>
  );
}
