import { useEffect } from "react";

import { useAuthStore } from "../../auth";
import { useSubscriptionStore } from "./subscriptionStore";

// 로그인·계정 변경·로그아웃에 맞춰 구독 공급자 계정을 동기화(#165 Slice 4B).
// userId 변화에 반응(마운트 1회 아님) — A→B 전환·로그아웃까지 세대 증가로 처리(Codex 블로커 C).
// 상위 authed 레이어에서 1회 마운트.
export function useSubscriptionAccount(): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const syncAccount = useSubscriptionStore((s) => s.syncAccount);
  useEffect(() => {
    syncAccount(userId);
  }, [userId, syncAccount]);
}
