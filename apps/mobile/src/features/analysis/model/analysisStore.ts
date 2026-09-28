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

  set: (patch: Partial<AnalysisStore>) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  phase: "idle",
  runId: 0,
  stateVersion: 0,
  doneCount: 0,
  totalCount: 0,
  pages: [],

  set: (patch) => set(patch),
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
    }),
}));
