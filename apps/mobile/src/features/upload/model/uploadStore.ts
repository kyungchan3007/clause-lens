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
  // 업로드 시점 불변 이미지 스냅샷(결과 화면 미리보기용, 세션 한정). 이후 초안 교체에 영향받지 않음.
  image?: { localUri: string; width: number; height: number };
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

  // runId는 외부에서 raw로 못 바꾼다(스테일 가드 우회 방지) — 세대 증가는 bumpRunWith 전용 경로로만.
  set: (patch: UploadPatch) => void;
  // 세대(runId) +1과 다른 필드 변경을 한 set으로 원자적 반영하고 새 세대를 반환한다.
  // 기존 `set({ runId: nextRun(), ...patch })`(start/retry/cancel)의 캡슐화 대체 — 원자성·set 횟수 동일.
  bumpRunWith: (patch: UploadPatch) => number;
  reset: () => void;
}

// 외부 set/bumpRunWith에는 runId를 넣지 못하게 막는다(세대는 bumpRunWith만 올린다).
export type UploadPatch = Omit<Partial<UploadStore>, "runId">;

export const useUploadStore = create<UploadStore>((set, get) => ({
  phase: "idle",
  runId: 0,
  sentCount: 0,
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
      clientRequestId: undefined,
      documentId: undefined,
      ownerUserId: undefined,
      sentCount: 0,
      totalCount: 0,
      pages: [],
      message: undefined,
    }),
}));
