import { create } from "zustand";
import type { PageAnalysisResult } from "@clause-lens/contracts";

// 분석 단계 — 서버 문서/job 상태를 앱 표현으로 매핑.
export type AnalysisPhase =
  | "idle"
  | "requesting" // analyze 요청 중(jobId 대기)
  | "analyzing" // 진행 중
  | "done" // 전체 성공
  | "partial" // 일부 성공·일부 실패
  | "failed" // 전체 실패
  | "error"; // 통신/요청 오류(서버 상태 아님)

interface AnalysisStore {
  phase: AnalysisPhase;
  runId: number; // 실행 세대 — stale 콜백/취소 판별
  documentId?: string;
  jobId?: string;
  stateVersion: number; // 마지막 적용 버전(역순 도착 방지)
  doneCount: number;
  totalCount: number;
  pages: PageAnalysisResult[];
  message?: string;
  // error 세부 — "quota"면 무료 소진 전용 화면으로 분기(제네릭 error와 구분).
  errorKind?: "quota";

  // runId는 외부에서 raw로 못 바꾼다(스테일 가드 우회 방지) — 세대 증가는 bumpRunWith 전용 경로로만.
  set: (patch: AnalysisPatch) => void;
  // 세대(runId) +1과 다른 필드 변경을 한 set으로 원자적 반영하고 새 세대를 반환한다.
  // 기존 `set({ runId: nextRun(), ...patch })`(start/cancel)의 캡슐화 대체 — 원자성·set 횟수 동일.
  bumpRunWith: (patch: AnalysisPatch) => number;
  reset: () => void;
}

// 외부 set/bumpRunWith에는 runId를 넣지 못하게 막는다(세대는 bumpRunWith만 올린다).
export type AnalysisPatch = Omit<Partial<AnalysisStore>, "runId">;

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  phase: "idle",
  runId: 0,
  stateVersion: 0,
  doneCount: 0,
  totalCount: 0,
  pages: [],

  set: (patch) => set(patch),
  bumpRunWith: (patch) => {
    const next = get().runId + 1;
    set({ ...patch, runId: next }); // runId를 마지막에 둬 patch가 덮지 못하게(타입으로도 차단).
    return next;
  },
  reset: () =>
    set({
      phase: "idle",
      documentId: undefined,
      jobId: undefined,
      stateVersion: 0,
      doneCount: 0,
      totalCount: 0,
      pages: [],
      message: undefined,
      errorKind: undefined,
    }),
}));
