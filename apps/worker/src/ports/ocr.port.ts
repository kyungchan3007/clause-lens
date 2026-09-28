// OCR 공급자 경계(포트). 실제 Vision 연동은 TASK-004에서 VisionOcrAdapter로 교체.
// 위험조항 판정은 여기 넣지 않는다(Clause Result 도메인, TASK-004).

export interface OcrPageInput {
  pageId: string;
  finalKey: string; // 확정 저장소 키(DB에서 읽은 값). 클라 경로·치수는 신뢰 안 함
  revision: number;
}

// TASK-004: 정규화된 텍스트·boxes·실측 이미지 치수·신뢰도. 이번 stub은 상태만 검증.
export type OcrPageResult = Record<string, never>;

// 일시 오류(자동 재시도 대상) — attempts 예산 내에서 BullMQ 재시도.
export class OcrTransientError extends Error {
  constructor(public readonly code = "ocr_timeout") {
    super(code);
    this.name = "OcrTransientError";
  }
}

// 영구 오류(비재시도 종결) — invalid_image·ocr_failed 등.
export class OcrPermanentError extends Error {
  constructor(public readonly code = "ocr_failed") {
    super(code);
    this.name = "OcrPermanentError";
  }
}

export abstract class OcrPort {
  abstract analyzePage(input: OcrPageInput): Promise<OcrPageResult>;
}
