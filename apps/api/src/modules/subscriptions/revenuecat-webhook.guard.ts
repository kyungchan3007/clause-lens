import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

// 웹훅 인증 설정(DI). 운영 활성 시 authorization 필수. hmacSecret 설정 시 서명도 검증.
export const REVENUECAT_WEBHOOK_CONFIG = "REVENUECAT_WEBHOOK_CONFIG";
export interface RevenueCatWebhookConfig {
  authorization: string; // 대시보드 정적 Authorization 헤더값(필수)
  hmacSecret?: string; // X-RevenueCat-Webhook-Signature HMAC 시크릿(선택)
  toleranceSec: number; // HMAC 타임스탬프 허용오차(초)
}

// 상수시간 비교 — 길이 선검사(timingSafeEqual은 동일 길이 요구). 길이 노출은 무해.
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// "t=<정수>,v1=<hex>" 엄격 파싱. 형식 안 맞으면 null.
export function parseSignatureHeader(header: string): { t: number; v1: string } | null {
  let t: number | null = null;
  let v1: string | null = null;
  for (const part of header.split(",")) {
    const [k, val] = part.trim().split("=");
    if (k === "t" && /^\d+$/.test(val ?? "")) t = Number(val);
    else if (k === "v1" && /^[0-9a-fA-F]+$/.test(val ?? "")) v1 = (val ?? "").toLowerCase();
  }
  if (t == null || v1 == null) return null;
  return { t, v1 };
}

interface RawRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

function headerValue(req: RawRequest, name: string): string {
  const v = req.headers[name];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

// 파싱된 body를 신뢰하기 전에 원본 Buffer로 인증(Codex 리뷰: raw body 기준·재직렬화 금지).
@Injectable()
export class RevenueCatWebhookGuard implements CanActivate {
  constructor(
    @Inject(REVENUECAT_WEBHOOK_CONFIG) private readonly config: RevenueCatWebhookConfig,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RawRequest>();

    // 정적 Authorization — 미설정이면 전부 거부(빈값끼리 통과 금지).
    const expected = this.config.authorization;
    if (!expected) throw new UnauthorizedException("webhook_not_configured");
    if (!constantTimeEqual(headerValue(req, "authorization"), expected)) {
      throw new UnauthorizedException("bad_authorization");
    }

    // 선택 HMAC — 원본 Buffer 기준, 형식·시간차 엄격.
    if (this.config.hmacSecret) {
      const raw = req.rawBody;
      if (!raw || raw.length === 0) throw new UnauthorizedException("missing_raw_body");
      const parsed = parseSignatureHeader(headerValue(req, "x-revenuecat-webhook-signature"));
      if (!parsed) throw new UnauthorizedException("bad_signature_format");
      const ageSec = Math.abs(Date.now() / 1000 - parsed.t);
      if (ageSec > this.config.toleranceSec) throw new UnauthorizedException("signature_expired");
      const mac = createHmac("sha256", this.config.hmacSecret)
        .update(`${parsed.t}.`)
        .update(raw)
        .digest("hex");
      if (!constantTimeEqual(mac, parsed.v1)) throw new UnauthorizedException("bad_signature");
    }
    return true;
  }
}
