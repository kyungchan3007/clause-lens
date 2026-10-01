import type { AnalysisPhase } from "../../../features/analysis";
import type { ProcessingPhase } from "../../../features/home";
import type { UploadPhase } from "../../../features/upload";

export type SessionPhase = "idle" | ProcessingPhase;

export interface SessionView {
  phase: SessionPhase;
  sentCount: number; // 업로드=전송 페이지, 분석=완료 페이지
  totalCount: number;
  message?: string;
  // 분석 error 세부 — "quota"면 무료 소진 전용 화면으로 분기.
  errorKind?: "quota";
}

export interface SessionSources {
  uploadPhase: UploadPhase;
  sentCount: number;
  totalCount: number;
  uploadMessage?: string;
  analysisPhase: AnalysisPhase;
  analysisDone: number;
  analysisTotal: number;
  analysisMessage?: string;
  analysisErrorKind?: "quota";
}

const UPLOAD_ACTIVE: readonly UploadPhase[] = ["presigning", "uploading", "confirming"];
const ANALYSIS_ACTIVE: readonly AnalysisPhase[] = ["requesting", "analyzing"];

export const isUploadActive = (p: UploadPhase): boolean => UPLOAD_ACTIVE.includes(p);
export const isAnalysisActive = (p: AnalysisPhase): boolean => ANALYSIS_ACTIVE.includes(p);

// 업로드+분석을 하나의 표시 상태로 병합.
export function mergeSessionPhase(s: SessionSources): SessionView {
  if (s.uploadPhase === "error") {
    return {
      phase: "error",
      sentCount: s.sentCount,
      totalCount: s.totalCount,
      message: s.uploadMessage,
    };
  }
  if (isUploadActive(s.uploadPhase)) {
    return {
      phase: s.uploadPhase as ProcessingPhase,
      sentCount: s.sentCount,
      totalCount: s.totalCount,
      message: s.uploadMessage,
    };
  }
  if (s.uploadPhase === "uploaded") {
    if (s.analysisPhase === "idle") {
      return { phase: "uploaded", sentCount: s.sentCount, totalCount: s.totalCount };
    }
    return {
      phase: s.analysisPhase,
      sentCount: s.analysisDone,
      totalCount: s.analysisTotal,
      message: s.analysisMessage,
      errorKind: s.analysisErrorKind,
    };
  }
  return { phase: "idle", sentCount: 0, totalCount: 0 };
}
