const mockDetect = jest.fn();
jest.mock("@google-cloud/vision", () => ({
  ImageAnnotatorClient: jest.fn().mockImplementation(() => ({
    documentTextDetection: mockDetect,
  })),
}));

import { ImageAnnotatorClient } from "@google-cloud/vision";

import { VisionOcrAdapter } from "./vision-ocr.adapter";
import { OcrPermanentError, OcrTransientError } from "../ports/ocr.port";

// resetMocks:true가 생성자 구현까지 리셋 → 매 테스트 전에 재설정.
beforeEach(() => {
  (ImageAnnotatorClient as unknown as jest.Mock).mockImplementation(() => ({
    documentTextDetection: mockDetect,
  }));
});

function para(text: string, x: number, y: number) {
  return {
    confidence: 0.9,
    boundingBox: {
      vertices: [
        { x, y },
        { x: x + 100, y },
        { x: x + 100, y: y + 20 },
        { x, y: y + 20 },
      ],
    },
    words: [{ symbols: text.split("").map((c) => ({ text: c })) }],
  };
}

const input = { imageBytes: new Uint8Array([1]), imageWidth: 1000, imageHeight: 1400 };

describe("VisionOcrAdapter", () => {
  it("문단 → 블록(텍스트+좌표) 정규화", async () => {
    mockDetect.mockResolvedValue([
      {
        fullTextAnnotation: {
          pages: [{ width: 1000, height: 1400, blocks: [{ paragraphs: [para("자동갱신", 10, 20)] }] }],
        },
      },
    ]);
    const out = await new VisionOcrAdapter().recognize(input);
    expect(out.blocks).toHaveLength(1);
    expect(out.blocks[0]).toMatchObject({ id: "b0", text: "자동갱신", box: { x: 10, y: 20, width: 100, height: 20 } });
  });

  it("Vision 치수 != upright 치수 → ocr_failed", async () => {
    mockDetect.mockResolvedValue([
      { fullTextAnnotation: { pages: [{ width: 999, height: 1400, blocks: [] }] } },
    ]);
    await expect(new VisionOcrAdapter().recognize(input)).rejects.toBeInstanceOf(OcrPermanentError);
  });

  it("텍스트 미검출 → 빈 블록", async () => {
    mockDetect.mockResolvedValue([{ fullTextAnnotation: null }]);
    const out = await new VisionOcrAdapter().recognize(input);
    expect(out.blocks).toEqual([]);
  });

  it("응답 내부 오류 → ocr_failed", async () => {
    mockDetect.mockResolvedValue([{ error: { message: "bad" } }]);
    await expect(new VisionOcrAdapter().recognize(input)).rejects.toBeInstanceOf(OcrPermanentError);
  });

  it("호출 예외(쿼터·5xx) → 일시 오류", async () => {
    mockDetect.mockRejectedValue(new Error("quota"));
    await expect(new VisionOcrAdapter().recognize(input)).rejects.toBeInstanceOf(OcrTransientError);
  });
});
