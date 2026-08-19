import { View } from "react-native";
import { useDraftStore } from "../model/draftStore";
import { EmptyState } from "./EmptyState";
import { PageList } from "./PageList";

export function CaptureScreen() {
  const hasPages = useDraftStore((s) => s.pages.length > 0);

  return (
    <View className="flex-1 bg-background">
      {hasPages ? <PageList /> : <EmptyState />}
    </View>
  );
}
