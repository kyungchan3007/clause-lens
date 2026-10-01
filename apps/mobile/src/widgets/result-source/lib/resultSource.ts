import type { ResultImage } from "../../../features/result";
import type { UploadPageState } from "../../../features/upload";

export interface LiveResultInput {
  requestedDocId?: string;
  userId?: string;
  analysisDocId?: string;
  uploadDocId?: string;
  uploadOwner?: string;
  pageCount: number;
}

// 방금 분석한 문서인가(메모리 스냅샷 + 소유자 일치) — 이미지 포함 결과. 다른 계정의 메모리 결과 노출 방지.
export function isLiveResult(s: LiveResultInput): boolean {
  return (
    !!s.requestedDocId &&
    s.analysisDocId === s.requestedDocId &&
    s.uploadDocId === s.requestedDocId &&
    !!s.userId &&
    s.userId === s.uploadOwner &&
    s.pageCount > 0
  );
}

// 업로드 시점 이미지 스냅샷 → 서버 pageId별 결과 이미지.
export function toImageByPageId(
  uploadPages: readonly UploadPageState[] | undefined,
): Record<string, ResultImage | undefined> {
  const map: Record<string, ResultImage | undefined> = {};
  for (const p of uploadPages ?? []) {
    if (p.pageId && p.image) {
      map[p.pageId] = {
        uri: p.image.localUri,
        width: p.image.width,
        height: p.image.height,
      };
    }
  }
  return map;
}
