import {
  ANALYSIS_ERROR_CODES,
  coerceAnalysisErrorCode,
  isAnalysisErrorCode,
} from "./analysis";

// errorCode 영속/응답 가드(#133) — 공개 계약 밖 코드가 DB·응답에 새지 않도록 하는 런타임 경계.
describe("coerceAnalysisErrorCode (#133)", () => {
  it("valid 코드는 그대로 통과(동작 불변) — 전체 계약 코드", () => {
    for (const code of ANALYSIS_ERROR_CODES) {
      expect(coerceAnalysisErrorCode(code)).toBe(code);
    }
  });

  it("대표 valid 코드(analysis_failed·invalid_image)는 치환되지 않음", () => {
    expect(coerceAnalysisErrorCode("analysis_failed")).toBe("analysis_failed");
    expect(coerceAnalysisErrorCode("invalid_image")).toBe("invalid_image");
  });

  it("worker 전용 stub 코드(stub_disabled_in_production)는 안전 기본값으로 치환", () => {
    expect(coerceAnalysisErrorCode("stub_disabled_in_production")).toBe(
      "analysis_failed",
    );
  });

  it("임의 문자열은 안전 기본값으로 치환", () => {
    expect(coerceAnalysisErrorCode("boom")).toBe("analysis_failed");
    expect(coerceAnalysisErrorCode("")).toBe("analysis_failed");
  });

  it("비문자열 입력(undefined·null·숫자·객체)도 안전 기본값으로 치환", () => {
    expect(coerceAnalysisErrorCode(undefined)).toBe("analysis_failed");
    expect(coerceAnalysisErrorCode(null)).toBe("analysis_failed");
    expect(coerceAnalysisErrorCode(123)).toBe("analysis_failed");
    expect(coerceAnalysisErrorCode({})).toBe("analysis_failed");
  });

  it("fallback 인자를 지정하면 그 값으로 치환", () => {
    expect(coerceAnalysisErrorCode("stub_disabled_in_production", "worker_failed")).toBe(
      "worker_failed",
    );
  });
});

describe("isAnalysisErrorCode (#133)", () => {
  it("계약 코드는 true", () => {
    expect(isAnalysisErrorCode("analysis_failed")).toBe(true);
    expect(isAnalysisErrorCode("ocr_timeout")).toBe(true);
  });

  it("계약 밖 코드·비문자열은 false", () => {
    expect(isAnalysisErrorCode("stub_disabled_in_production")).toBe(false);
    expect(isAnalysisErrorCode("boom")).toBe(false);
    expect(isAnalysisErrorCode(undefined)).toBe(false);
    expect(isAnalysisErrorCode(42)).toBe(false);
  });
});
