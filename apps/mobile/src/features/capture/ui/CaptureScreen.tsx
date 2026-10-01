import type { ReactNode } from "react";
import { View } from "react-native";
import { useDraftStore } from "../model/draftStore";
import { EmptyState } from "./EmptyState";
import { PageList, type AnalyzeControls } from "./PageList";

// analyze 제어는 app 레이어에서 조합해 주입(capture는 upload를 import하지 않음).
// emptyExtra: 담긴 페이지가 없을 때 홈 하단에 끼울 콘텐츠(최근 분석 등). app 레이어가 주입.
export function CaptureScreen({
  analyze,
  emptyExtra,
}: {
  analyze?: AnalyzeControls;
  emptyExtra?: ReactNode;
}) {
  const hasPages = useDraftStore((s) => s.pages.length > 0);

  return (
    <View className="flex-1 bg-background">
      {hasPages ? <PageList analyze={analyze} /> : <EmptyState extra={emptyExtra} />}
    </View>
  );
}
