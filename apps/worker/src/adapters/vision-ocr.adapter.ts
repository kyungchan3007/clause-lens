import { Injectable } from "@nestjs/common";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import type { Box, OcrBlock } from "@clause-lens/db/analysis";

import { loadConfig } from "../config";
import {
  OcrPermanentError,
  OcrPort,
  OcrTransientError,
  type OcrInput,
  type OcrResult,
} from "../ports/ocr.port";

// Google Cloud Vision 어댑터(gRPC → REST 10MB 제한 회피). DOCUMENT_TEXT_DETECTION.
// 좌표는 upright 원본 픽셀. 이미지 바이트·OCR 텍스트 로그 금지.
@Injectable()
export class VisionOcrAdapter extends OcrPort {
  private readonly client: ImageAnnotatorClient;
  private readonly languageHints: string[];

  constructor() {
    super();
    this.languageHints = loadConfig().gcvLanguageHints;
    this.client = createClient();
  }

  async recognize(input: OcrInput): Promise<OcrResult> {
    let result;
    try {
      const [res] = await this.client.documentTextDetection({
        image: { content: Buffer.from(input.imageBytes) },
        imageContext: { languageHints: this.languageHints },
      });
      result = res;
    } catch {
      // 쿼터·5xx·타임아웃 등 → 일시 오류(재시도). 인증/설정 오류는 부팅검증+상위 알림으로 분리.
      throw new OcrTransientError("ocr_timeout");
    }

    if (result.error?.message) throw new OcrPermanentError("ocr_failed"); // 응답 내부 오류

    const fta = result.fullTextAnnotation;
    if (!fta?.pages?.length) return { blocks: [] }; // 텍스트 미검출 → processor가 판독불가 처리

    // Vision 반환 치수 == 우리 upright 치수 검증(불일치 = 좌표계 오염 → 종결).
    const first = fta.pages[0];
    if (
      first.width != null &&
      first.height != null &&
      (first.width !== input.imageWidth || first.height !== input.imageHeight)
    ) {
      throw new OcrPermanentError("ocr_failed");
    }

    const blocks: OcrBlock[] = [];
    let i = 0;
    for (const page of fta.pages) {
      for (const block of page.blocks ?? []) {
        for (const para of block.paragraphs ?? []) {
          const text = (para.words ?? [])
            .map((w) => (w.symbols ?? []).map((s) => s.text ?? "").join(""))
            .join(" ")
            .trim();
          if (!text) continue;
          const box = toBox(para.boundingBox, input.imageWidth, input.imageHeight);
          if (!box) continue;
          blocks.push({
            id: `b${i++}`,
            text,
            box,
            confidence: para.confidence ?? undefined,
          });
        }
      }
    }
    return { blocks };
  }
}

// boundingBox vertices(픽셀) → axis-aligned box, [0,W]×[0,H] clamp.
function toBox(
  bb: { vertices?: Array<{ x?: number | null; y?: number | null }> | null } | null | undefined,
  w: number,
  h: number,
): Box | null {
  const vs = bb?.vertices;
  if (!vs || vs.length === 0) return null;
  const xs = vs.map((v) => clamp(v.x ?? 0, 0, w));
  const ys = vs.map((v) => clamp(v.y ?? 0, 0, h));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function createClient(): ImageAnnotatorClient {
  // (1) API 키(AIza...) — REST 전송으로 사용(gRPC는 API 키 미지원).
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    return new ImageAnnotatorClient({
      apiKey,
      fallback: "rest",
    } as unknown as ConstructorParameters<typeof ImageAnnotatorClient>[0]);
  }
  // (2) 서비스계정 JSON 인라인.
  const raw = process.env.GCP_SA_KEY_JSON;
  if (raw) {
    const sa = JSON.parse(raw) as { client_email: string; private_key: string; project_id?: string };
    return new ImageAnnotatorClient({
      credentials: { client_email: sa.client_email, private_key: sa.private_key },
      projectId: sa.project_id,
    });
  }
  // (3) GOOGLE_APPLICATION_CREDENTIALS(SA 파일 경로) 자동 사용.
  return new ImageAnnotatorClient();
}
