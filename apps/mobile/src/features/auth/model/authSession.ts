// 세션 매니저(#126) — access 토큰 자동 갱신의 동시성·세대·무효화를 한 곳에서 소유한다.
// - single-flight: 동시 다발 401이 refresh 1회로 합류(공유 promise).
// - 세대 비교: 이미 갱신된 뒤 늦게 온 구토큰 401은 네트워크 없이 현재 토큰으로 재시도.
// - 실패 정책: 확정 인증 실패(refresh 토큰 거부=401/403)만 세션 정리 + 무효화 알림.
//   일시 장애(네트워크·5xx)는 세션 유지(과도한 로그아웃 방지).
// - 경합 방어: refresh 도중 로그인/로그아웃으로 세션이 바뀌면, 이전 요청이 새 세션을
//   덮어쓰거나 지우지 못하게 refresh 토큰으로 세션 동일성을 확인한다.
// client는 이 모듈을 configureAuthGateway로 주입받아 401 재시도에 refreshAccess를 호출한다.

import { AuthRefreshRejectedError, refresh as refreshApi } from "../api/authApi";
import { clearSession, loadSession, saveSession } from "../lib/secureSession";

type OnAuthLost = () => void;

let onAuthLost: OnAuthLost | null = null;

// 확정 인증 실패로 세션이 정리될 때 호출(authStore가 상태를 unauthenticated로). 서버 logout과는 분리.
export function setOnAuthLost(cb: OnAuthLost | null): void {
  onAuthLost = cb;
}

export async function getAccessToken(): Promise<string | null> {
  return (await loadSession())?.accessToken ?? null;
}

// 진행 중 refresh 공유 promise(single-flight). 완료 시 해제.
let refreshPromise: Promise<string> | null = null;

// 401 시 client가 호출. prevAccessToken = 방금 실패한 요청이 쓴 access.
// 반환: 재시도에 쓸 새 access. throw: 확정 인증 실패 또는 일시 장애(둘 다 재시도 중단).
export function refreshAccess(prevAccessToken: string): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh(prevAccessToken).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefresh(prevAccessToken: string): Promise<string> {
  const current = await loadSession();
  if (!current) {
    // 세션이 없다(이미 로그아웃됨) → 더 할 게 없음. 무효화 알림은 중복 방지로 생략.
    throw new AuthRefreshRejectedError();
  }
  // 다른 요청이 이미 갱신해 토큰이 바뀜 → 네트워크 없이 현재 토큰으로 재시도(늦은 401).
  if (current.accessToken !== prevAccessToken) {
    return current.accessToken;
  }

  try {
    const result = await refreshApi(current.refreshToken);
    // 경합 방어: 그 사이 세션이 바뀌었으면(로그인/로그아웃) 이 결과로 덮어쓰지 않는다.
    const now = await loadSession();
    if (!now || now.refreshToken !== current.refreshToken) {
      return now?.accessToken ?? result.accessToken;
    }
    await saveSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result.accessToken;
  } catch (e) {
    if (e instanceof AuthRefreshRejectedError) {
      // 확정 인증 실패 → 세션 정리 + 무효화. 단, 그 사이 세션이 바뀌었으면 건드리지 않는다.
      const now = await loadSession();
      if (now && now.refreshToken === current.refreshToken) {
        await clearSession();
        onAuthLost?.();
      }
    }
    // 일시 장애(네트워크·5xx)는 세션을 유지한 채 그대로 전파(재시도 실패로 끝).
    throw e;
  }
}
