import { useEffect } from "react";

import { useAuthStore } from "../../auth";
import { useAnalysisStore } from "../../analysis";
import { useEntitlementStore } from "./entitlementStore";

// 앱 상위 레이어에서 1회 마운트. 기능 간 결합(인증·분석 → 자격 갱신)을 여기 한 곳에 모은다.
// 잔량은 terminal뿐 아니라 접수(예약) 시점에도 변하므로, 분석 phase 변화에서도 재조회한다.
export function useEntitlementSync(): void {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  // 인증: 로그인·계정 변경 → 계정 동기화 + 조회 / 로그아웃 → 초기화(이전 사용자 잔량 미노출).
  useEffect(() => {
    const store = useEntitlementStore.getState();
    if (status === "authenticated") {
      store.syncAccount(userId);
      void store.refresh();
    } else if (status === "unauthenticated") {
      store.syncAccount(null);
    }
  }, [status, userId]);

  // 분석 phase 변화 → 접수(analyzing)·terminal(done/partial/failed)·오류(403 포함)에서 재조회.
  // idle/requesting은 제외. 접수 성공 시 예약으로, 완료 시 확정/해제로 잔량이 바뀐다.
  const phase = useAnalysisStore((s) => s.phase);
  useEffect(() => {
    if (phase === "idle" || phase === "requesting") return;
    void useEntitlementStore.getState().refresh();
  }, [phase]);
}
