import type { AnalysisErrorCode } from "@clause-lens/contracts";
import type { OcrBlock } from "@clause-lens/db/analysis";

import type { WorkerErrorCode } from "../lib/errors";

// OCR 공급자 경계(포트). 구현 = Vision(실) / Stub(개발·단위).
// 좌표만 담당(위험 판정은 ClauseAnalyzerPort). 입력은 검증·정규화된 upright 바이트+치수.
// 에러코드는 @clause-lens/contracts 단일 소스(값 불변, #131). 스텁 전용 코드는 WorkerErrorCode로 보존.

export interface OcrInput {
  imageBytes: Uint8Array; // EXIF 정규화된 upright 이미지(image-validator 출력)
  imageWidth: number; // upright 실측 치수(Vision 반환 치수와 교차검증 기준)
  imageHeight: number;
}

export interface OcrResult {
  blocks: OcrBlock[]; // 문단 단위, upright 원본 픽셀 box, 읽기 순서(b0..)
}

// 일시 오류(자동 재시도 대상) — attempts 예산 내 BullMQ 재시도.
export class OcrTransientError extends Error {
  constructor(public readonly code: AnalysisErrorCode = "ocr_timeout") {
    super(code);
    this.name = "OcrTransientError";
  }
}

// 영구 오류(비재시도 종결) — ocr_failed(거부·디코딩·치수 불일치) 등.
export class OcrPermanentError extends Error {
  constructor(public readonly code: WorkerErrorCode = "ocr_failed") {
    super(code);
    this.name = "OcrPermanentError";
  }
}

export abstract class OcrPort {
  abstract recognize(input: OcrInput): Promise<OcrResult>;
}
