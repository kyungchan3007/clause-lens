import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { createHmac } from "node:crypto";

import {
  constantTimeEqual,
  parseSignatureHeader,
  RevenueCatWebhookGuard,
  type RevenueCatWebhookConfig,
} from "./revenuecat-webhook.guard";

function ctxOf(headers: Record<string, string | undefined>, rawBody?: Buffer): ExecutionContext {
  const req = { headers, rawBody };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const AUTH = "secret-authorization-value";

describe("순수 헬퍼", () => {
  it("constantTimeEqual: 같으면 true, 길이 다르면 false", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });
  it("parseSignatureHeader: 형식 엄격", () => {
    expect(parseSignatureHeader("t=1700000000,v1=deadBEEF")).toEqual({ t: 1700000000, v1: "deadbeef" });
    expect(parseSignatureHeader("v1=abc")).toBeNull(); // t 없음
    expect(parseSignatureHeader("t=notint,v1=abc")).toBeNull();
    expect(parseSignatureHeader("t=1,v1=zz")).toBeNull(); // hex 아님
  });
});

describe("RevenueCatWebhookGuard (정적 Authorization)", () => {
  const cfg: RevenueCatWebhookConfig = { authorization: AUTH, toleranceSec: 300 };
  const guard = new RevenueCatWebhookGuard(cfg);

  it("일치 → 통과", () => {
    expect(guard.canActivate(ctxOf({ authorization: AUTH }))).toBe(true);
  });
  it("불일치 → 401", () => {
    expect(() => guard.canActivate(ctxOf({ authorization: "nope" }))).toThrow(UnauthorizedException);
  });
  it("설정 미존재 → 전부 거부(빈값 통과 금지)", () => {
    const g = new RevenueCatWebhookGuard({ authorization: "", toleranceSec: 300 });
    expect(() => g.canActivate(ctxOf({ authorization: "" }))).toThrow(UnauthorizedException);
  });
});

describe("RevenueCatWebhookGuard (HMAC)", () => {
  const secret = "whsec_test";
  const cfg: RevenueCatWebhookConfig = { authorization: AUTH, hmacSecret: secret, toleranceSec: 300 };
  const guard = new RevenueCatWebhookGuard(cfg);
  const raw = Buffer.from('{"event":{"id":"e1"}}\n', "utf8");

  function sign(t: number, body: Buffer): string {
    const v1 = createHmac("sha256", secret).update(`${t}.`).update(body).digest("hex");
    return `t=${t},v1=${v1}`;
  }

  it("유효 서명 → 통과 (raw Buffer 기준)", () => {
    const t = Math.floor(Date.now() / 1000);
    const ctx = ctxOf({ authorization: AUTH, "x-revenuecat-webhook-signature": sign(t, raw) }, raw);
    expect(guard.canActivate(ctx)).toBe(true);
  });
  it("raw body 누락 → 401", () => {
    const t = Math.floor(Date.now() / 1000);
    const ctx = ctxOf({ authorization: AUTH, "x-revenuecat-webhook-signature": sign(t, raw) });
    expect(() => guard.canActivate(ctx)).toThrow("missing_raw_body");
  });
  it("형식 오류 → 401", () => {
    const ctx = ctxOf({ authorization: AUTH, "x-revenuecat-webhook-signature": "garbage" }, raw);
    expect(() => guard.canActivate(ctx)).toThrow("bad_signature_format");
  });
  it("타임스탬프 만료 → 401", () => {
    const old = Math.floor(Date.now() / 1000) - 10_000;
    const ctx = ctxOf({ authorization: AUTH, "x-revenuecat-webhook-signature": sign(old, raw) }, raw);
    expect(() => guard.canActivate(ctx)).toThrow("signature_expired");
  });
  it("위조 서명(다른 body) → 401", () => {
    const t = Math.floor(Date.now() / 1000);
    const ctx = ctxOf(
      { authorization: AUTH, "x-revenuecat-webhook-signature": sign(t, Buffer.from("tampered")) },
      raw,
    );
    expect(() => guard.canActivate(ctx)).toThrow("bad_signature");
  });
});
