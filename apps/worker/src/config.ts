// worker 환경설정 + 부팅 검증(0021 §⑥). 비밀값은 env로만(로그 금지).
// production에서 실 어댑터 크레덴셜 누락 시 부팅 실패(fail-fast).

export const NORMALIZATION_VERSION = "ocr-v1"; // OCR 정규화 로직 버전(회귀 추적)
export const PROMPT_VERSION = "clause-v1"; // Claude 프롬프트 버전
export const SCHEMA_VERSION = "clause-schema-v1"; // 추출 스키마 버전
export const OCR_ENGINE = "gcv";
export const ORIENTATION = "exif-normalized";
export const VISION_MAX_BYTES = 20 * 1024 * 1024; // Google Vision 이미지 상한

export interface WorkerConfig {
  claudeModel: string;
  claudeEffort: string;
  claudeMaxTokens: number;
  claudeTimeoutMs: number;
  analysisMaxInputBlocks: number;
  analysisMaxInputChars: number;
  imageMaxBytes: number;
  imageMaxPixels: number;
  imageMinPixels: number;
  gcvLanguageHints: string[];
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

export function loadConfig(): WorkerConfig {
  return {
    claudeModel: process.env.CLAUDE_MODEL ?? "claude-opus-5",
    claudeEffort: process.env.CLAUDE_EFFORT ?? "medium",
    claudeMaxTokens: num(process.env.CLAUDE_MAX_TOKENS, 8000),
    claudeTimeoutMs: num(process.env.CLAUDE_TIMEOUT_MS, 60_000),
    analysisMaxInputBlocks: num(process.env.ANALYSIS_MAX_INPUT_BLOCKS, 400),
    analysisMaxInputChars: num(process.env.ANALYSIS_MAX_INPUT_CHARS, 60_000),
    imageMaxBytes: num(process.env.IMAGE_MAX_BYTES, 15 * 1024 * 1024),
    imageMaxPixels: num(process.env.IMAGE_MAX_PIXELS, 40_000_000),
    imageMinPixels: num(process.env.IMAGE_MIN_PIXELS, 100),
    gcvLanguageHints: (process.env.GCV_LANGUAGE_HINTS ?? "ko,en")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
export function hasVisionCreds(): boolean {
  return !!(
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCP_SA_KEY_JSON
  );
}
export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// production 부팅 검증 — 실 어댑터 크레덴셜 필수. 개발은 stub 허용.
export function assertBootConfig(): void {
  if (!isProduction()) return;
  const missing: string[] = [];
  if (!hasVisionCreds()) missing.push("GOOGLE_APPLICATION_CREDENTIALS|GCP_SA_KEY_JSON");
  if (!hasAnthropicKey()) missing.push("ANTHROPIC_API_KEY");
  if (missing.length > 0) {
    throw new Error(`worker boot: missing required config: ${missing.join(", ")}`);
  }
}
