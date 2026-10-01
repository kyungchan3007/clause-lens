import { create } from "zustand";
import type { EntitlementResponse } from "@clause-lens/contracts";

import { getAccessToken } from "../../auth";
import { fetchEntitlement } from "../api/entitlementApi";

// 무료 분석 잔량 상태. "서버가 진실의 기준" — freeRemaining을 표시만(앱이 −1 선반영·0으로 차단 금지).
// 설계: agents/intent/specs/0029-app-entitlement-display/ (Codex 토론 반영)
//  - 계정 격리: 요청 시작 시 generation 캡처 → 응답 반영 전 비교(계정 바뀌면 폐기).
//  - 겹친 refresh: in-flight면 pending만 세우고 완료 후 1회 더(과거 응답이 최신을 못 덮게).
//  - 표시 정책: 최초 loading(0 대체 금지)·최초 error·재조회 실패는 기존 값+staleError.

type Status = "idle" | "loading" | "ready" | "error";

interface EntitlementState {
  status: Status;
  data: EntitlementResponse | null;
  staleError: boolean; // 재조회 실패(기존 값 유지 중 최신 확인 실패)
  // 내부 상태
  generation: number;
  userId: string | null;
  inFlight: boolean;
  pending: boolean;
  // 액션
  refresh: () => Promise<void>;
  syncAccount: (userId: string | null) => void;
}

export const useEntitlementStore = create<EntitlementState>((set, get) => ({
  status: "idle",
  data: null,
  staleError: false,
  generation: 0,
  userId: null,
  inFlight: false,
  pending: false,

  // 로그인·복원·계정 변경·로그아웃에서 호출. 같은 userId(토큰 갱신 포함)면 유지, 바뀌면 세대++·초기화.
  syncAccount(userId) {
    if (get().userId === userId) return;
    set({
      generation: get().generation + 1,
      userId,
      status: "idle",
      data: null,
      staleError: false,
      pending: false,
    });
  },

  async refresh() {
    if (get().inFlight) {
      set({ pending: true }); // 겹침 → 완료 후 1회 더
      return;
    }
    const gen = get().generation;
    const token = await getAccessToken();
    if (get().generation !== gen) return; // 조회 사이 계정 변경
    if (!token) {
      set({ status: "idle", data: null, staleError: false });
      return;
    }
    set({
      inFlight: true,
      staleError: false,
      status: get().data ? get().status : "loading", // 최초만 로딩, 재조회는 기존 값 유지
    });
    try {
      const data = await fetchEntitlement(token);
      if (get().generation !== gen) return; // 계정 변경 → 폐기
      set({ status: "ready", data, staleError: false });
    } catch {
      if (get().generation !== gen) return;
      if (get().data) set({ staleError: true }); // 기존 값 유지 + 최신 확인 실패
      else set({ status: "error" });
    } finally {
      set({ inFlight: false });
      if (get().pending) {
        set({ pending: false });
        void get().refresh(); // 겹친 갱신 요구를 완료 후 1회 수행(현재 세대·토큰으로)
      }
    }
  },
}));
