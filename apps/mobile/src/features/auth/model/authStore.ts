import { create } from "zustand";

import { configureAuthGateway } from "../../../shared/api/client";
import * as authApi from "../api/authApi";
import type { SessionUser } from "../api/authApi";
import { refreshAccess, setOnAuthLost } from "./authSession";
import {
  clearSession,
  loadSession,
  saveSession,
  type StoredSession,
} from "../lib/secureSession";

// 게이트 3상태: 부팅 직후 SecureStore 조회 중(restoring) → 검증 결과에 따라 인증/비인증.
type AuthStatus = "restoring" | "unauthenticated" | "authenticated";

interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  restore: () => Promise<void>;
  setSession: (session: StoredSession, user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "restoring",
  user: null,

  async restore() {
    try {
      const session = await loadSession();
      if (!session) {
        set({ status: "unauthenticated", user: null });
        return;
      }
      // 토큰 문자열 존재만으로 인증하지 않고 서버(/auth/me)로 검증.
      const user = await authApi.fetchMe(session.accessToken);
      set({ status: "authenticated", user });
    } catch {
      // 부팅 검증(/auth/me) 실패 → 재로그인 유도. 런타임 API 호출의 만료(401)는
      // 공통 계층이 자동 refresh·재시도로 처리한다(#126, authSession).
      set({ status: "unauthenticated", user: null });
    }
  },

  async setSession(session, user) {
    // 저장 실패 시 예외가 전파되어 인증 성공 처리되지 않는다(호출부가 에러 표시).
    await saveSession(session);
    set({ status: "authenticated", user });
  },

  async signOut() {
    const session = await loadSession();
    if (session) {
      await authApi.logout(session.refreshToken);
    }
    await clearSession();
    set({ status: "unauthenticated", user: null });
  },
}));

// 자동 토큰 갱신 배선(#126): 공통 HTTP 계층이 401 시 세션 매니저로 refresh·재시도하게 하고,
// 확정 인증 실패(refresh 거부) 시 세션 매니저가 스토어 상태만 비인증으로 전이시킨다
// (서버 logout을 부르는 signOut과 분리 — 이미 거부된 세션에 재요청하지 않기 위함).
configureAuthGateway({ refreshAccess });
setOnAuthLost(() => useAuthStore.setState({ status: "unauthenticated", user: null }));
