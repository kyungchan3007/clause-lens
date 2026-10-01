import { ActivityIndicator, Text, View } from "react-native";
import { Button, Icon, Notice } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";
import { DocScanGraphic } from "./DocScanGraphic";
import { IndeterminateBar } from "./IndeterminateBar";
import { useReduceMotion } from "./useReduceMotion";

// 업로드+분석을 병합한 표시 phase(app 레이어 merged와 동일). feature→feature import 방지 위해 로컬 정의.
export type ProcessingPhase =
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

export interface ProcessingState {
  phase: ProcessingPhase;
  sentCount: number; // 업로드=전송 페이지, 분석=완료 페이지
  totalCount: number;
  message?: string;
  onCancel: () => void; // 업로드=전송 실제 중단 / 분석=관찰 중단(서버는 계속)
  onRetry: () => void;
  onViewResult?: () => void;
  onReset?: () => void; // done/partial에서 담은 페이지 비우고 처음으로(새 계약서).
}

type Mode = "upload" | "analysis" | "done" | "partial" | "error";

function modeOf(p: ProcessingPhase): Mode {
  switch (p) {
    case "presigning":
    case "uploading":
    case "confirming":
      return "upload";
    case "uploaded":
    case "requesting":
    case "analyzing":
      return "analysis";
    case "done":
      return "done";
    case "partial":
      return "partial";
    default:
      return "error"; // failed·error
  }
}

// 진행 문구(가짜 % 금지) — 서버가 주는 유일한 이산 정보는 "완료 페이지 수"뿐.
// 페이지당 내부(OCR·분석) 진행률이 없어 바는 항상 indeterminate(흐르는 띠), 완료 수는 다페이지일 때만 텍스트.
function progressText(mode: Mode, p: ProcessingPhase, sent: number, total: number): string {
  if (mode === "upload") {
    if (p === "presigning") return "업로드 준비 중…";
    if (p === "confirming") return "서버 확인 중…";
    return total >= 2 ? `${total}장 중 ${sent}장 전송` : "전송 중…"; // uploading
  }
  // analysis
  if (p === "requesting" || p === "uploaded") return "분석 요청 중…";
  return total >= 2 ? `${total}페이지 중 ${sent}페이지 완료` : "분석 중…"; // analyzing
}

function hero(mode: Mode): { title: string; sub?: string } {
  switch (mode) {
    case "upload":
      return { title: "계약서를 올리고 있어요", sub: "사진을 안전하게 전송하는 중…" };
    case "analysis":
      return { title: "계약서를 분석하고 있어요", sub: "불리할 수 있는 조항을 찾는 중…" };
    case "done":
      return { title: "분석이 끝났어요", sub: "결과를 확인해 보세요." };
    case "partial":
      return { title: "일부만 분석됐어요", sub: "분석된 페이지의 결과를 볼 수 있어요." };
    case "error":
      return { title: "분석에 문제가 생겼어요" };
  }
}

export function ProcessingScreen(state: ProcessingState) {
  const mode = modeOf(state.phase);
  const h = hero(mode);
  const reduceMotion = useReduceMotion();
  const progressing = mode === "upload" || mode === "analysis";
  const ptext = progressing
    ? progressText(mode, state.phase, state.sentCount, state.totalCount)
    : null;

  return (
    <View className="flex-1 px-5">
      {/* 히어로(중앙) */}
      <View className="flex-1 items-center justify-center">
        {mode === "error" ? (
          <View className="mb-7 h-20 w-20 items-center justify-center rounded-full bg-danger-bg">
            <Icon name="TriangleAlert" size={36} color={color("danger")} />
          </View>
        ) : mode === "done" || mode === "partial" ? (
          <View className="mb-7 h-20 w-20 items-center justify-center rounded-full bg-success-bg">
            <Icon name="ShieldCheck" size={36} color={color("success")} />
          </View>
        ) : (
          <DocScanGraphic animate={mode === "analysis"} />
        )}

        <Text
          accessibilityRole="header"
          className="text-center text-[22px] font-extrabold tracking-tight text-foreground"
        >
          {h.title}
        </Text>
        {h.sub ? (
          <Text className="mt-2.5 text-center text-sm text-foreground-muted">{h.sub}</Text>
        ) : null}
        {progressing && state.totalCount > 0 ? (
          <Text className="mt-1.5 text-center text-xs text-foreground-muted">
            계약서 {state.totalCount}페이지
          </Text>
        ) : null}
        {mode === "error" && state.message ? (
          <Text className="mt-2.5 max-w-[280px] text-center text-sm text-danger-text">
            {state.message}
          </Text>
        ) : null}

        {/* 진행 블록 — 흐르는 바(위치 주장 X) + 완료 수 텍스트. reduced-motion이면 스피너. */}
        {progressing ? (
          <View className="mt-7 w-full max-w-[280px]">
            {reduceMotion ? (
              <View
                className="flex-row items-center justify-center gap-2"
                accessibilityLiveRegion="polite"
              >
                <ActivityIndicator size="small" color={color("primary")} />
                <Text className="text-sm text-foreground-muted">{ptext}</Text>
              </View>
            ) : (
              <>
                <IndeterminateBar />
                <Text
                  accessibilityLiveRegion="polite"
                  className="mt-2.5 text-center text-[13px] text-foreground-muted"
                >
                  {ptext}
                </Text>
              </>
            )}
          </View>
        ) : null}
      </View>

      {/* 안심/안내 Notice — 분석 구간만 "앱 닫아도 계속"(서버 독립 실행). 업로드는 반대 안내. */}
      {mode === "analysis" ? (
        <Notice tone="success" icon="ShieldCheck">
          서버에서 분석 중이에요. 앱을 닫아도 분석은 계속돼요.
        </Notice>
      ) : mode === "upload" ? (
        <Notice tone="neutral" icon="Info">
          전송이 끝날 때까지 앱을 열어 두세요.
        </Notice>
      ) : null}

      {/* 하단 액션(모드별) */}
      <View className="gap-2 pb-2 pt-3">
        {mode === "upload" ? (
          <Button label="취소" variant="secondary" onPress={state.onCancel} />
        ) : mode === "analysis" ? (
          <Button label="나가기" variant="secondary" onPress={state.onCancel} />
        ) : mode === "done" || mode === "partial" ? (
          <>
            <Button
              label={mode === "done" ? "결과 보기" : "분석된 결과 보기"}
              variant="primary"
              onPress={() => state.onViewResult?.()}
            />
            {state.onReset ? (
              <Button label="새 계약서 분석" variant="ghost" onPress={state.onReset} />
            ) : null}
          </>
        ) : (
          <>
            <Button label="다시 시도" variant="primary" onPress={state.onRetry} />
            <Button label="페이지 확인" variant="ghost" onPress={state.onCancel} />
          </>
        )}
      </View>
    </View>
  );
}
