import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { DraftImageInput } from "../model/types";

// 픽한 이미지를 JPEG로 정규화(iOS HEIC 등 백엔드 화이트리스트 밖 대응) + 실측 크기.
// 정규화 산출물(고유 URI)을 그대로 업로드하고 그 크기를 presign에 사용한다(백엔드 정확일치).
export async function normalizeToJpeg(uri: string): Promise<DraftImageInput | null> {
  try {
    const context = ImageManipulator.manipulate(uri);
    const rendered = await context.renderAsync();
    const image = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.85,
    });
    const info = await FileSystem.getInfoAsync(image.uri);
    if (!info.exists || typeof info.size !== "number" || info.size <= 0) {
      return null;
    }
    // 표시용 썸네일(그리드 카드) — 원본 12MP를 그대로 다수 렌더하면 메모리가 큼.
    // 실패해도 렌더는 되게 localUri로 폴백.
    const thumbUri = await makeThumbnail(image.uri, image.width).catch(() => image.uri);
    return {
      localUri: image.uri,
      thumbUri,
      width: image.width,
      height: image.height,
      contentType: "image/jpeg",
      sizeBytes: info.size,
    };
  } catch {
    // 디코딩/저장 실패(손상·미지원) → 추가하지 않음(호출부에서 재선택 안내). 원문 로깅 금지.
    return null;
  }
}

// 그리드 카드용 축소 썸네일(JPEG). targetW 상한을 둬 과도한 디코딩 메모리를 막는다.
// 2열 카드 ≈ 화면폭 절반 × 픽셀비율이면 충분 → 상한 540px.
const THUMB_MAX_W = 540;
export async function makeThumbnail(uri: string, srcWidth: number): Promise<string> {
  const targetW = Math.min(THUMB_MAX_W, srcWidth > 0 ? srcWidth : THUMB_MAX_W);
  const ctx = ImageManipulator.manipulate(uri).resize({ width: targetW });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return out.uri;
}
