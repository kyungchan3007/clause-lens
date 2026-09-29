import { Injectable } from "@nestjs/common";

import {
  OcrPermanentError,
  OcrPort,
  OcrTransientError,
  type OcrInput,
  type OcrResult,
} from "../ports/ocr.port";

// 실제 Vision 없이 파이프라인(검증·상태·확정·매핑)을 개발·단위 검증하는 stub. 결정적(env 제어).
//   STUB_OCR_MODE   success(기본) | permanent | transient
//   STUB_OCR_ALLOW_PROD  운영 가짜성공 방지 가드 해제(기본 금지)
@Injectable()
export class StubOcrAdapter extends OcrPort {
  async recognize(input: OcrInput): Promise<OcrResult> {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.STUB_OCR_ALLOW_PROD !== "1"
    ) {
      throw new OcrPermanentError("stub_disabled_in_production");
    }
    const mode = process.env.STUB_OCR_MODE ?? "success";
    if (mode === "permanent") throw new OcrPermanentError("ocr_failed");
    if (mode === "transient") throw new OcrTransientError("ocr_timeout");

    // 결정적 가짜 블록 2개(문서 상단/하단). 좌표는 입력 치수 기준.
    const w = input.imageWidth;
    const h = input.imageHeight;
    return {
      blocks: [
        {
          id: "b0",
          text: "본 계약은 만료 30일 전까지 별도 통보가 없으면 동일 조건으로 자동 갱신된다.",
          box: { x: 20, y: 40, width: Math.max(1, w - 40), height: 60 },
          confidence: 0.98,
        },
        {
          id: "b1",
          text: "위약금은 잔여 계약금액의 50%로 한다.",
          box: { x: 20, y: Math.max(120, h - 120), width: Math.max(1, w - 40), height: 50 },
          confidence: 0.97,
        },
      ],
    };
  }
}
