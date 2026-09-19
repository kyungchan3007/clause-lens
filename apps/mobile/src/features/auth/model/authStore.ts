import { create } from "zustand";

import * as authApi from "../api/authApi";
import type { SessionUser } from "../api/authApi";
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
      // 만료·검증 실패 → 재로그인 유도(refresh 자동화는 후속).
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
