// 공통 authed fetch 클라이언트. 5개 기능 api가 복붙하던 baseUrl·Authorization·에러·파싱을 단일화.
// 각 api는 경로·스키마(·바디)만 선언한다. 토큰·URL은 로그로 남기지 않는다(guardrail).
// "서버가 진실의 기준" — 클라이언트는 호출·검증만, 판단은 서버.
//
// 자동 토큰 갱신(#126): 401이면 주입된 게이트웨이로 refresh → **1회** 재시도한다.
// client는 전송·HttpError만 담당하고, refresh의 동시성(single-flight)·세션 정리·무효화는
// 세션 매니저(features/auth/model/authSession)가 소유한다. 게이트웨이 미주입이면 기존 동작(throw).

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

// 401 자동 갱신 게이트웨이. 앱 초기화 시 세션 매니저가 주입한다(shared→features 직접 import 금지).
export interface AuthGateway {
  // 401 시 호출. 방금 실패한 요청이 쓴 토큰을 넘기면 새 access를 돌려준다
  // (이미 다른 요청이 갱신했으면 네트워크 없이 현재 토큰). 확정 인증 실패면 throw.
  refreshAccess: (prevAccessToken: string) => Promise<string>;
}

let authGateway: AuthGateway | null = null;

export function configureAuthGateway(gateway: AuthGateway | null): void {
  authGateway = gateway;
}

// zod 스키마에 직접 의존하지 않도록 구조적 타입만 요구(contracts의 zod 스키마가 자연히 호환).
interface Parser<T> {
  parse: (data: unknown) => T;
}

function getRequest(path: string, accessToken: string): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

function postRequest(path: string, accessToken: string, body: unknown): Promise<Response> {
  const hasBody = body !== undefined;
  return fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: hasBody
      ? { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }
      : { Authorization: `Bearer ${accessToken}` },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
}

// 401 + 게이트웨이 주입 시: refresh 후 새 토큰으로 **1회**만 재시도한다.
// 재시도 결과(성공·실패 무관)를 그대로 반환해 추가 refresh 루프를 막는다.
// refreshAccess가 throw(확정 인증 실패)하면 그 에러를 전파(세션 정리·무효화는 게이트웨이가 수행).
async function sendWithRefresh(
  accessToken: string,
  send: (token: string) => Promise<Response>,
): Promise<Response> {
  const res = await send(accessToken);
  if (res.status !== 401 || !authGateway) return res;
  const newToken = await authGateway.refreshAccess(accessToken);
  return send(newToken);
}

// 인증 GET — Authorization 헤더 + 401 자동 갱신 + status 분기 + 응답 스키마 파싱.
export async function authedGet<T>(
  path: string,
  accessToken: string,
  schema: Parser<T>,
): Promise<T> {
  const res = await sendWithRefresh(accessToken, (token) => getRequest(path, token));
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
  const res = await sendWithRefresh(accessToken, (token) => postRequest(path, token, body));
  if (!res.ok) throw new HttpError(res.status);
  return schema.parse(await res.json());
}
