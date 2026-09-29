import sharp, { type OutputInfo } from "sharp";

import { VISION_MAX_BYTES } from "../config";
import { ValidationError } from "./errors";

// 이미지 실검증(0021 §③·G2). Vision 호출 **전** 수행 — 쓰레기에 Vision 낭비 금지.
// - 바이트/픽셀 상한, 실제 디코딩(손상 검출), MIME/포맷·declaredContentType 교차
// - EXIF orientation 정규화(upright) → 좌표계 단일화(0021 R2-4·R2-5)
// - upright 재인코딩(JPEG) 출력이 Vision 20MB 초과면 image_too_large
// 결과 치수 = upright 원본 해상도(리사이즈 안 함) → 앱이 표시하는 원본과 좌표 일치.

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export interface ValidatedImage {
  uprightBytes: Buffer; // EXIF 적용된 upright JPEG(원본 해상도)
  width: number; // upright 실측
  height: number;
  format: string; // 원본 포맷(jpeg|png|webp)
}

export interface ValidateOpts {
  declaredContentType?: string;
  maxBytes: number;
  maxPixels: number;
  minPixels: number;
}

export async function validateImage(
  bytes: Uint8Array,
  opts: ValidateOpts,
): Promise<ValidatedImage> {
  if (bytes.byteLength > opts.maxBytes) throw new ValidationError("invalid_image");

  const input = Buffer.from(bytes);

  // 1) 메타데이터 — 포맷·매직바이트 확인(디코딩 없이 헤더).
  let format: string | undefined;
  try {
    const meta = await sharp(input, { limitInputPixels: opts.maxPixels }).metadata();
    format = meta.format;
  } catch {
    throw new ValidationError("invalid_image"); // 손상·미지원 헤더
  }
  if (!format || !ALLOWED_FORMATS.has(format)) throw new ValidationError("invalid_image");
  if (opts.declaredContentType && !contentTypeMatches(opts.declaredContentType, format)) {
    throw new ValidationError("invalid_image");
  }

  // 2) 실제 디코딩 + EXIF 정규화(rotate) → upright 버퍼(손상은 여기서 throw).
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(input, { limitInputPixels: opts.maxPixels })
      .rotate() // EXIF orientation 적용(1~8)
      .jpeg({ quality: 90 }) // Vision 입력 정규화(원본 해상도 유지, 리사이즈 없음)
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ValidationError("invalid_image");
  }

  const width = out.info.width;
  const height = out.info.height;
  const pixels = width * height;
  if (pixels < opts.minPixels || pixels > opts.maxPixels) {
    throw new ValidationError("invalid_image");
  }
  // 리사이즈 없이 원본 해상도 JPEG이 Vision 상한 초과 → 분석 입력 과대(비재시도).
  if (out.data.byteLength > VISION_MAX_BYTES) {
    throw new ValidationError("image_too_large");
  }

  return { uprightBytes: out.data, width, height, format };
}

function contentTypeMatches(declared: string, actual: string): boolean {
  const d = declared.toLowerCase();
  if (actual === "jpeg") return d.includes("jpeg") || d.includes("jpg");
  return d.includes(actual);
}
