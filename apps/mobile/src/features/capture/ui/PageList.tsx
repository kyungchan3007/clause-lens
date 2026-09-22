import { View, Text, Pressable } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Button, Icon } from "@clause-lens/ui";
import { semantic } from "@clause-lens/tokens";
import { useDraftStore } from "../model/draftStore";
import { useImagePicker } from "../model/useImagePicker";
import { PageItem } from "./PageItem";
import type { DraftPage } from "../model/types";

// 업로드 제어(서버 개념 없이 로컬 타입) — app 레이어가 주입. feature→feature import 방지.
export interface AnalyzeControls {
  phase: "idle" | "presigning" | "uploading" | "confirming" | "uploaded" | "error";
  sentCount: number;
  totalCount: number;
  message?: string;
  onAnalyze: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

const ACTIVE = ["presigning", "uploading", "confirming"];

function statusLabel(a: AnalyzeControls): string | null {
  switch (a.phase) {
    case "presigning":
      return "업로드 준비 중…";
    case "uploading":
      return `전송 중 ${a.sentCount}/${a.totalCount}`;
    case "confirming":
      return "서버 확인 중…";
    case "uploaded":
      return "업로드 완료";
    case "error":
      return a.message ?? "업로드 실패";
    default:
      return null;
  }
}

export function PageList({ analyze }: { analyze?: AnalyzeControls }) {
  const pages = useDraftStore((s) => s.pages);
  const setPages = useDraftStore((s) => s.setPages);
  const locked = useDraftStore((s) => s.locked);
  const { captureToDraft } = useImagePicker();

  const active = analyze ? ACTIVE.includes(analyze.phase) : false;
  const label = analyze ? statusLabel(analyze) : null;

  return (
    <View className="flex-1 px-4 pt-3">
      <DraggableFlatList
        data={pages}
        keyExtractor={(p) => p.id}
        onDragEnd={({ data }) => setPages(data)}
        renderItem={({ item, drag, isActive }: RenderItemParams<DraftPage>) => (
          <PageItem page={item} drag={drag} isActive={isActive} />
        )}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <Pressable
            onPress={() => captureToDraft("library")}
            disabled={locked}
            className={`mt-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 ${locked ? "opacity-40" : ""}`}
            accessibilityLabel="페이지 추가"
          >
            <Icon name="Plus" size={17} color={semantic.light.primary} />
            <Text className="text-sm font-medium text-primary">페이지 추가</Text>
          </Pressable>
        }
      />
      <View className="py-3">
        {label ? (
          <Text
            className={`mb-2 text-center text-xs ${analyze?.phase === "error" ? "text-danger" : "text-foreground-muted"}`}
          >
            {label}
          </Text>
        ) : (
          <Text className="mb-2 text-center text-xs text-foreground-muted">
            끌어서 순서 변경 · 탭해서 교체
          </Text>
        )}

        {analyze?.phase === "error" ? (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="다시 시도" variant="primary" onPress={analyze.onRetry} />
            </View>
          </View>
        ) : active ? (
          <Button label="취소" variant="secondary" onPress={analyze!.onCancel} />
        ) : analyze?.phase === "uploaded" ? (
          <Button label="업로드 완료" variant="secondary" onPress={() => {}} />
        ) : (
          <Button
            label="분석하기"
            variant="primary"
            onPress={() => analyze?.onAnalyze()}
          />
        )}
      </View>
    </View>
  );
}
