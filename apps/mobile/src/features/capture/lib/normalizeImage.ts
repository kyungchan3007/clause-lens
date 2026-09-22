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
    return {
      localUri: image.uri,
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
