// 공통 authed fetch 클라이언트. 5개 기능 api가 복붙하던 baseUrl·Authorization·에러·파싱을 단일화.
// 각 api는 경로·스키마(·바디)만 선언한다. 토큰·URL은 로그로 남기지 않는다(guardrail).
// "서버가 진실의 기준" — 클라이언트는 호출·검증만, 판단은 서버.

import { HttpError } from "../http";

// 공유 HttpError 재노출(소비자가 client 경유로도 동일 클래스에 접근).
export { HttpError };

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export function baseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL 누락 — apps/mobile/.env 확인");
  }
  return API_BASE_URL;
}

// zod 스키마에 직접 의존하지 않도록 구조적 타입만 요구(contracts의 zod 스키마가 자연히 호환).
interface Parser<T> {
  parse: (data: unknown) => T;
}

// 인증 GET — Authorization 헤더 + status 분기 + 응답 스키마 파싱.
export async function authedGet<T>(
  path: string,
  accessToken: string,
  schema: Parser<T>,
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(res.status);
  return schema.parse(await res.json());
}

// 인증 POST — 바디가 있으면 JSON 바디 + Content-Type, 없으면 Authorization만(바디 없는 POST 보존).
export async function authedPost<T>(
  path: string,
  accessToken: string,
  body: unknown,
  schema: Parser<T>,
): Promise<T> {
  const hasBody = body !== undefined;
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: hasBody
      ? {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        }
      : { Authorization: `Bearer ${accessToken}` },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new HttpError(res.status);
  return schema.parse(await res.json());
}
