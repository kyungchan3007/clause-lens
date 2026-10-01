import type { AnalysisErrorCode } from "@clause-lens/contracts";

// worker 오류 분류(0021 §⑤). 메시지에 민감정보(텍스트·바이트·프롬프트) 금지 — 코드만.
// OCR 오류(OcrTransientError·OcrPermanentError)는 ports/ocr.port.ts.

// 에러코드는 @clause-lens/contracts의 AnalysisErrorCode 단일 소스(값 불변, drift 차단, #131).
// 단, 스텁·개발 전용 비상 코드는 공개 계약에 넣지 않고 worker 전용으로 확장 보존.
export type WorkerErrorCode = AnalysisErrorCode | "stub_disabled_in_production";

// 이미지 검증 실패 — 비재시도 종결.
export class ValidationError extends Error {
  constructor(
    public readonly code: Extract<AnalysisErrorCode, "invalid_image" | "image_too_large"> = "invalid_image",
  ) {
    super(code);
    this.name = "ValidationError";
  }
}

// 분석 일시 오류(자동 재시도 대상).
export class AnalysisTransientError extends Error {
  constructor(public readonly code: AnalysisErrorCode = "analysis_timeout") {
    super(code);
    this.name = "AnalysisTransientError";
  }
}

// 분석 영구 오류(비재시도 종결) — refusal·스키마 위반·근거 검증 실패.
export class AnalysisPermanentError extends Error {
  constructor(public readonly code: WorkerErrorCode = "analysis_failed") {
    super(code);
    this.name = "AnalysisPermanentError";
  }
}
