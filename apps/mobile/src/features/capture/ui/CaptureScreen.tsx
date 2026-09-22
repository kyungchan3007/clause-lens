import { View } from "react-native";
import { useDraftStore } from "../model/draftStore";
import { EmptyState } from "./EmptyState";
import { PageList, type AnalyzeControls } from "./PageList";

// analyze 제어는 app 레이어에서 조합해 주입(capture는 upload를 import하지 않음).
export function CaptureScreen({ analyze }: { analyze?: AnalyzeControls }) {
  const hasPages = useDraftStore((s) => s.pages.length > 0);

  return (
    <View className="flex-1 bg-background">
      {hasPages ? <PageList analyze={analyze} /> : <EmptyState />}
    </View>
  );
}
