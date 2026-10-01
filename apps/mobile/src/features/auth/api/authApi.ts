// 백엔드 auth 계약(apps/api/src/modules/auth). 응답 shape는 서버 AuthResult와 일치.
// zod contract 공유(packages/contracts)는 후속 — 지금은 최소 타입으로 시작.
// baseUrl만 공통 client에서 공유. 커스텀 에러 메시지·무스키마 반환은 보존(동작 불변).

import { baseUrl } from "../../../shared/api/client";

export interface SessionUser {
  id: string;
  provider: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

// 앱이 카카오 SDK로 받은 access token을 서버로 넘겨 우리 JWT 세션을 교환.
export async function loginWithKakao(kakaoAccessToken: string): Promise<AuthResult> {
  const res = await fetch(`${baseUrl()}/auth/kakao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: kakaoAccessToken }),
  });
  if (!res.ok) {
    throw new Error(`카카오 로그인 실패 (${res.status})`);
  }
  return (await res.json()) as AuthResult;
}

// 세션 복원 시 서버로 검증(토큰 존재만으로 인증 처리하지 않기 위함).
export async function fetchMe(accessToken: string): Promise<SessionUser> {
  const res = await fetch(`${baseUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`세션 검증 실패 (${res.status})`);
  }
  return (await res.json()) as SessionUser;
}

// 로그아웃은 서버 refresh 폐기 시도. 실패해도 로컬 세션은 별도로 정리한다.
export async function logout(refreshToken: string): Promise<void> {
  try {
    await fetch(`${baseUrl()}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // 네트워크 실패 무시 — 로컬 정리는 호출부가 보장.
  }
}
