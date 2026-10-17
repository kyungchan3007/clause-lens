import { create } from "zustand";

import { getAccessToken } from "../../auth";
import {
  isStaleGeneration,
  syncAccount as syncAccountState,
  type AccountScopedState,
} from "../../../shared/model/accountScopedStore";
import { fetchAccess, identify } from "../api/billingApi";
import { selectPurchasePort } from "./selectPurchasePort";
import type { PurchasePort, SubscriptionPlan } from "./purchasePort";

// 구독 흐름 상태(#165 Slice 4B). **구매 성공≠권한** — 분리 상태로 정직하게 표현(Codex 블로커 A).
//  purchasing/restoring: 스토어 처리 중 · confirming: 서버 반영 확인 중 · active: 현재 권한 활성
//  delayed: 스토어는 성공, 서버 반영 확인 지연(재확인=재구매 아님) · no_target/conflict/cancelled/error.
export type SubscriptionFlow =
  | "idle"
  | "purchasing"
  | "restoring"
  | "confirming"
  | "active"
  | "delayed"
  | "no_target"
  | "conflict"
  | "cancelled"
  | "error";

export type OfferingsStatus = "idle" | "loading" | "ready" | "error";

export interface ConfirmTiming {
  baseMs: number;
  maxAttempts: number;
  deadlineMs: number;
}
const DEFAULT_TIMING: ConfirmTiming = { baseMs: 1000, maxAttempts: 6, deadlineMs: 20_000 };
const realWait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface SubscriptionState extends AccountScopedState {
  offeringsStatus: OfferingsStatus;
  plans: SubscriptionPlan[];
  flow: SubscriptionFlow;
  inFlight: boolean; // single-flight: 구매/복원/확인 1건
  // 주입(테스트 대체 가능)
  _port: PurchasePort;
  _wait: (ms: number) => Promise<void>;
  _timing: ConfirmTiming;
  // 액션
  syncAccount: (userId: string | null) => void;
  loadOfferings: () => Promise<void>;
  purchase: (planId: string) => Promise<void>;
  restore: () => Promise<void>;
  recheck: () => Promise<void>;
  __configureForTest: (deps: Partial<Pick<SubscriptionState, "_port" | "_wait" | "_timing">>) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  // 공급자 현재 상태가 권한으로 반영됐는지 확인 — identify(재동기화 트리거) → access 제한 폴링.
  // access는 "현재 권한" 신호(보관 가능 or 구독 소스)일 뿐 "이번 거래" 완료 증거가 아니다 → 분리 상태.
  async function confirmFlow(gen: number): Promise<void> {
    if (isStaleGeneration(get, gen)) return;
    set({ flow: "confirming" });
    const token = await getAccessToken();
    if (isStaleGeneration(get, gen)) return;
    if (!token) {
      set({ flow: "error" });
      return;
    }
    try {
      await identify(token); // 매핑 보장 + 서버 재동기화 트리거
    } catch {
      // 베스트에포트 — 이후 access 폴링으로 반영 확인
    }
    const { baseMs, maxAttempts, deadlineMs } = get()._timing;
    const start = Date.now();
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (isStaleGeneration(get, gen)) return;
      try {
        const access = await fetchAccess(token);
        if (isStaleGeneration(get, gen)) return;
        if (access.storage.canSave || access.analysis.source === "subscription") {
          set({ flow: "active" });
          return;
        }
      } catch {
        // 일시 오류 — 마감 전까지 재시도
      }
      if (Date.now() - start >= deadlineMs) break;
      await get()._wait(Math.min(baseMs * 2 ** attempt, deadlineMs));
      if (Date.now() - start >= deadlineMs) break;
    }
    if (isStaleGeneration(get, gen)) return;
    set({ flow: "delayed" }); // 스토어 성공·서버 반영 확인 지연. 재확인은 recheck(재구매 아님).
  }

  // 로그인/계정 변경 직후 — 공급자 식별 + identify. 늦은 콜백이 새 계정 토큰으로 identify 호출하지 않도록 세대 가드.
  async function linkAccount(gen: number, userId: string): Promise<void> {
    try {
      await get()._port.configureAccount(userId);
    } catch {
      /* 공급자 미설정 등 — 무시(사용 시점에 실패) */
    }
    if (isStaleGeneration(get, gen)) return;
    const token = await getAccessToken();
    if (isStaleGeneration(get, gen) || !token) return;
    try {
      await identify(token);
    } catch {
      /* best effort */
    }
  }

  return {
    generation: 0,
    userId: null,
    offeringsStatus: "idle",
    plans: [],
    flow: "idle",
    inFlight: false,
    _port: selectPurchasePort(),
    _wait: realWait,
    _timing: DEFAULT_TIMING,

    syncAccount(userId) {
      const prev = get().userId;
      syncAccountState(get, set, userId, {
        offeringsStatus: "idle",
        plans: [],
        flow: "idle",
        inFlight: false,
      });
      if (get().userId === prev) return; // 변경 없음
      const gen = get().generation;
      if (userId) void linkAccount(gen, userId);
      else void get()._port.logOut().catch(() => undefined);
    },

    async loadOfferings() {
      const gen = get().generation;
      set({ offeringsStatus: get().plans.length ? get().offeringsStatus : "loading" });
      try {
        const plans = await get()._port.getOfferings();
        if (isStaleGeneration(get, gen)) return;
        set({ plans, offeringsStatus: "ready" });
      } catch {
        if (isStaleGeneration(get, gen)) return;
        set({ offeringsStatus: "error" });
      }
    },

    async purchase(planId) {
      if (get().inFlight) return; // single-flight(중복 탭·자동 동기화 겹침 흡수)
      const gen = get().generation;
      set({ inFlight: true, flow: "purchasing" });
      try {
        const outcome = await get()._port.purchase(planId);
        if (isStaleGeneration(get, gen)) return; // 계정 전환 → 폐기
        if (outcome === "cancelled") set({ flow: "cancelled" });
        else if (outcome === "conflict") set({ flow: "conflict" });
        else await confirmFlow(gen); // purchased → 서버 반영 확인
      } catch {
        if (!isStaleGeneration(get, gen)) set({ flow: "error" });
      } finally {
        set({ inFlight: false });
      }
    },

    async restore() {
      if (get().inFlight) return;
      const gen = get().generation;
      set({ inFlight: true, flow: "restoring" });
      try {
        const outcome = await get()._port.restore();
        if (isStaleGeneration(get, gen)) return;
        if (outcome === "no_target") set({ flow: "no_target" });
        else if (outcome === "conflict") set({ flow: "conflict" });
        else await confirmFlow(gen); // restored → 서버 반영 확인
      } catch {
        if (!isStaleGeneration(get, gen)) set({ flow: "error" });
      } finally {
        set({ inFlight: false });
      }
    },

    // delayed에서 "재확인" — identify+access 재개(재구매 아님).
    async recheck() {
      if (get().inFlight) return;
      const gen = get().generation;
      set({ inFlight: true });
      try {
        await confirmFlow(gen);
      } finally {
        set({ inFlight: false });
      }
    },

    __configureForTest(deps) {
      set(deps);
    },
  };
});
