import * as SecureStore from "expo-secure-store";

// 백엔드 JWT 세션(access·refresh)을 기기 보안 저장소에 보관.
// 카카오 토큰은 저장하지 않는다(서버 교환 후 폐기) — 우리 토큰만 신뢰.
//
// 두 토큰을 단일 JSON 항목으로 저장한다: setItemAsync 2회로 나누면
// 두 번째 실패 시 access만 남는 부분 저장(세션 불일치)이 생길 수 있어,
// 한 번의 쓰기로 원자적으로 다룬다.

const SESSION_KEY = "cl.auth.session";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

// 저장 실패는 예외로 전파한다(호출부에서 로그인 성공 처리 금지 판단).
export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    // 손상된 값 → best-effort 제거(반복 파싱 실패 방지). 삭제 실패해도
    // loadSession은 예외를 전파하지 않고 null 반환(복원·시작 흐름 보호).
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch {
      // 로깅 없이 무시(토큰·PII 로그 금지). 다음 저장이 값을 덮어씀.
    }
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
