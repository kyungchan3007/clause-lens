import { Injectable } from "@nestjs/common";

import {
  OcrPermanentError,
  OcrPort,
  OcrTransientError,
  type OcrPageInput,
  type OcrPageResult,
} from "../ports/ocr.port";

// 실제 Vision 없이 상태머신·폴링/SSE·멱등·복원을 검증하는 stub. 결정적 동작(env 제어).
//   STUB_OCR_DELAY_MS         처리 지연(기본 300ms)
//   STUB_OCR_MODE             success(기본) | permanent | transient — 전역 결과 모드
//   STUB_OCR_FAIL_PAGE_IDS    특정 pageId(csv)만 영구 실패 → 부분실패 실측
//   STUB_OCR_ALLOW_PROD       운영에서 가짜 성공 방지 가드 해제(기본 금지)
@Injectable()
export class StubOcrAdapter extends OcrPort {
  async analyzePage(input: OcrPageInput): Promise<OcrPageResult> {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.STUB_OCR_ALLOW_PROD !== "1"
    ) {
      // 운영에서 stub이 가짜 성공으로 기본 동작하지 않도록 방어(Codex R1 #13).
      throw new OcrPermanentError("stub_disabled_in_production");
    }

    const delay = Number(process.env.STUB_OCR_DELAY_MS ?? 300);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));

    const failIds = (process.env.STUB_OCR_FAIL_PAGE_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const mode = process.env.STUB_OCR_MODE ?? "success";

    if (failIds.includes(input.pageId) || mode === "permanent") {
      throw new OcrPermanentError("ocr_failed");
    }
    if (mode === "transient") {
      throw new OcrTransientError("ocr_timeout");
    }
    return {};
  }
}
