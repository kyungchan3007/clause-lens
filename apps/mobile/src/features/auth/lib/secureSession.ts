import * as SecureStore from "expo-secure-store";

// 백엔드 JWT 세션(access·refresh)을 기기 보안 저장소에 보관.
// 카카오 토큰은 저장하지 않는다(서버 교환 후 폐기) — 우리 토큰만 신뢰.

const ACCESS_KEY = "cl.auth.accessToken";
const REFRESH_KEY = "cl.auth.refreshToken";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

// 저장 실패는 예외로 전파한다(호출부에서 로그인 성공 처리 금지 판단).
export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, session.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
