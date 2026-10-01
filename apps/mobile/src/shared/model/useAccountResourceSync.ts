import { useEffect } from "react";

import { useAuthStore } from "../../features/auth";
import { useAnalysisStore, type AnalysisPhase } from "../../features/analysis";

// 계정 자원(재열람 목록·무료 잔량) 동기화 배선 공통화.
// 인증(로그인·계정 변경·로그아웃)과 분석 phase 변화에 따른 재조회를 한 곳에 모은다.
// 조건이 다른 부분(어떤 phase에서 재조회할지)만 refreshOnPhase로 파라미터화하고,
// 나머지 배선(authenticated→syncAccount+refresh / unauthenticated→syncAccount(null))은 동일.
//
// store는 getState()만 사용하므로 사용 표면만 구조 타이핑한다
// (zustand UseBoundStore의 setState/subscribe 변성 충돌 회피).

interface AccountResource {
  syncAccount: (userId: string | null) => void;
  refresh: () => Promise<void>;
}

interface Options {
  /** 이 phase에서 재조회할지 — true면 refresh. 소비 훅이 모듈 상수로 넘겨 참조를 안정화한다. */
  refreshOnPhase: (phase: AnalysisPhase) => boolean;
}

export function useAccountResourceSync(
  store: { getState: () => AccountResource },
  { refreshOnPhase }: Options,
): void {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  // 인증: 로그인·계정 변경 → 동기화 + 조회 / 로그아웃 → 초기화(이전 사용자 값 미노출).
  useEffect(() => {
    const resource = store.getState();
    if (status === "authenticated") {
      resource.syncAccount(userId);
      void resource.refresh();
    } else if (status === "unauthenticated") {
      resource.syncAccount(null);
    }
  }, [status, userId, store]);

  // 분석 phase 변화 → refreshOnPhase 조건이면 재조회.
  const phase = useAnalysisStore((s) => s.phase);
  useEffect(() => {
    if (refreshOnPhase(phase)) {
      void store.getState().refresh();
    }
  }, [phase, store, refreshOnPhase]);
}
