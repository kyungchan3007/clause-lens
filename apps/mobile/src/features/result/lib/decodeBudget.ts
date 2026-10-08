// 정규화 이미지 디코드 메모리 예산(#176). 대형 이미지를 Skia로 전부 디코드하면 메모리 급증·OOM·GPU 텍스처 한계.
// 예산 초과 시 Skia 경로를 쓰지 않고 안전 폴백(기존 Image+SVG 또는 안내).

export const MAX_DECODE_PIXELS = 24_000_000; // ~24MP (RGBA ≈ 96MB) — 모바일 디코드 상한
export const MAX_DECODE_SIDE = 8192; // GPU 최대 텍스처 변(보수적) 방어

// 정규화 이미지가 디코드 예산 안인가. 치수가 유효(양수)하고 픽셀수·최대변 모두 상한 이하일 때만 true.
export function withinDecodeBudget(
  width: number,
  height: number,
  maxPixels = MAX_DECODE_PIXELS,
  maxSide = MAX_DECODE_SIDE,
): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  if (Math.max(width, height) > maxSide) return false;
  return width * height <= maxPixels;
}
