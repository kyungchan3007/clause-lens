import sharp from "sharp";

import { validateImage } from "./image-validator";
import { ValidationError } from "./errors";

const OPTS = { maxBytes: 15 * 1024 * 1024, maxPixels: 40_000_000, minPixels: 100 };

async function jpeg(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .jpeg()
    .toBuffer();
}

describe("validateImage", () => {
  it("정상 JPEG → upright 치수·포맷 반환", async () => {
    const buf = await jpeg(200, 100);
    const out = await validateImage(buf, { ...OPTS, declaredContentType: "image/jpeg" });
    expect(out.width).toBe(200);
    expect(out.height).toBe(100);
    expect(out.format).toBe("jpeg");
  });

  it("PNG 허용", async () => {
    const buf = await sharp({ create: { width: 120, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .png()
      .toBuffer();
    const out = await validateImage(buf, { ...OPTS, declaredContentType: "image/png" });
    expect(out.format).toBe("png");
  });

  it("EXIF orientation 적용(upright 정규화) → 치수 회전", async () => {
    // orientation=6 (90°) → 200x100 이 100x200 으로 정규화되어야 함
    const buf = await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 1, g: 1, b: 1 } } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await validateImage(buf, OPTS);
    expect(out.width).toBe(100);
    expect(out.height).toBe(200);
  });

  it("바이트 상한 초과 → invalid_image", async () => {
    const buf = await jpeg(200, 100);
    await expect(validateImage(buf, { ...OPTS, maxBytes: 10 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("손상 이미지 → invalid_image", async () => {
    await expect(validateImage(Buffer.from("not an image"), OPTS)).rejects.toBeInstanceOf(ValidationError);
  });

  it("declaredContentType 불일치 → invalid_image", async () => {
    const buf = await jpeg(200, 100);
    await expect(
      validateImage(buf, { ...OPTS, declaredContentType: "image/png" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("최소 픽셀 미만 → invalid_image", async () => {
    const buf = await jpeg(5, 5); // 25px < 100
    await expect(validateImage(buf, OPTS)).rejects.toBeInstanceOf(ValidationError);
  });
});
