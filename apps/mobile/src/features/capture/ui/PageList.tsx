import { View, Text, Pressable } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Button, Icon } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";
import { useDraftStore } from "../model/draftStore";
import { useImagePicker } from "../model/useImagePicker";
import { PageItem } from "./PageItem";
import type { DraftPage } from "../model/types";

// 업로드+분석 제어(서버 개념 없이 로컬 타입) — app 레이어가 조합·주입. feature→feature import 방지.
export interface AnalyzeControls {
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
  sentCount: number; // 진행 카운트(업로드=전송, 분석=완료 페이지)
  totalCount: number;
  message?: string;
  onAnalyze: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onViewResult?: () => void; // 완료·부분완료 시 결과 화면으로
}

// 진행 중(취소 노출) 단계.
const ACTIVE = [
  "presigning",
  "uploading",
  "confirming",
  "uploaded",
  "requesting",
  "analyzing",
];

// 진행률(%) — 카운트 기반 단계(업로드·분석)에서 사용.
function pct(a: AnalyzeControls): number {
  return a.totalCount > 0 ? Math.round((a.sentCount / a.totalCount) * 100) : 0;
}

// 진행 바를 보여줄 단계(카운트가 의미 있는 구간).
const PROGRESS_PHASES = ["uploading", "analyzing"];

function statusLabel(a: AnalyzeControls): string | null {
  switch (a.phase) {
    case "presigning":
      return "업로드 준비 중…";
    case "uploading":
      return `전송 중 ${pct(a)}% (${a.sentCount}/${a.totalCount})`;
    case "confirming":
      return "서버 확인 중…";
    case "uploaded":
      return "업로드 완료 · 분석 시작…";
    case "requesting":
      return "분석 요청 중…";
    case "analyzing":
      return `분석 중 ${pct(a)}% (${a.sentCount}/${a.totalCount})`;
    case "done":
      return "분석 완료";
    case "partial":
      return a.message ?? "일부 페이지 분석 실패";
    case "failed":
      return a.message ?? "분석 실패";
    case "error":
      return a.message ?? "오류가 발생했어요";
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
            <Icon name="Plus" size={17} color={color("primary")} />
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

        {analyze && PROGRESS_PHASES.includes(analyze.phase) && analyze.totalCount > 0 ? (
          <View
            className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-border"
            accessibilityRole="progressbar"
          >
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct(analyze)}%` }}
            />
          </View>
        ) : null}

        {analyze?.phase === "error" ? (
          <Button label="다시 시도" variant="primary" onPress={analyze.onRetry} />
        ) : active ? (
          <Button label="취소" variant="secondary" onPress={analyze!.onCancel} />
        ) : analyze?.phase === "done" ? (
          <Button label="결과 보기" variant="primary" onPress={() => analyze?.onViewResult?.()} />
        ) : analyze?.phase === "partial" ? (
          <Button label="결과 보기 (일부 완료)" variant="primary" onPress={() => analyze?.onViewResult?.()} />
        ) : analyze?.phase === "failed" ? (
          <Button label="분석 실패" variant="secondary" onPress={() => {}} />
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
