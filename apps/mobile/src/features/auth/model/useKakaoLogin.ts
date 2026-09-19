import { useState } from "react";
import { login as kakaoLogin } from "@react-native-kakao/user";

import * as authApi from "../api/authApi";
import { useAuthStore } from "./authStore";

// 로그인 오케스트레이션: 카카오 SDK → access token → 서버 교환 → 세션 저장.
export function useKakaoLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      // 카카오톡 미설치(시뮬레이터 등)면 SDK가 카카오계정 로그인으로 폴백.
      const token = await kakaoLogin();
      const result = await authApi.loginWithKakao(token.accessToken);
      await setSession(
        { accessToken: result.accessToken, refreshToken: result.refreshToken },
        result.user,
      );
    } catch (e) {
      // 사용자 취소 포함. 토큰·프로필 원문은 로그로 남기지 않는다(guardrail).
      setError(e instanceof Error ? e.message : "로그인에 실패했어요");
    } finally {
      setLoading(false);
    }
  }

  return { signIn, loading, error };
}
