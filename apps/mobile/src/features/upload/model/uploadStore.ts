import { create } from "zustand";

// 전송 성공(PUT)과 서버 확정(complete)을 상태에서 구분한다(Codex 2R P1-5).
export type UploadPhase =
  | "idle"
  | "presigning"
  | "uploading"
  | "confirming"
  | "uploaded"
  | "error";

export interface UploadPageState {
  draftId: string;
  order: number;
  pageId?: string; // presign 후 서버 페이지 id
  put: boolean; // 저장소 PUT 성공 여부(전송)
  server: "pending" | "uploaded"; // 서버 확정 여부
  error?: string;
  retryable?: boolean;
}

interface UploadStore {
  phase: UploadPhase;
  runId: number; // 실행 세대 — stale 콜백/취소 판별
  clientRequestId?: string; // 첫 presign 전 생성·세션 내 보존(멱등)
  documentId?: string;
  ownerUserId?: string; // 세션 소유자 — 계정 변경 시 무효화 판단
  sentCount: number;
  totalCount: number;
  pages: UploadPageState[];
  message?: string;

  set: (patch: Partial<UploadStore>) => void;
  reset: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  phase: "idle",
  runId: 0,
  sentCount: 0,
  totalCount: 0,
  pages: [],

  set: (patch) => set(patch),
  reset: () =>
    set({
      phase: "idle",
      clientRequestId: undefined,
      documentId: undefined,
      ownerUserId: undefined,
      sentCount: 0,
      totalCount: 0,
      pages: [],
      message: undefined,
    }),
}));
