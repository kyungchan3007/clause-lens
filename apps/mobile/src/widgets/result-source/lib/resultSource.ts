import type { ResultImage } from "../../../features/result";
import type { UploadPageState } from "../../../features/upload";

export interface ResultGateInput {
  requestedDocId?: string;
  userId?: string;
  analysisDocId?: string;
  analysisOwner?: string;
  uploadDocId?: string;
  uploadOwner?: string;
  pageCount: number;
}

// 결과 가시성(#76) — 방금 분석한 문서의 메모리 결과를 보여줄지. **분석 소유자** 기준.
// 교차 사용자 격리의 1차 방어: 현재 사용자 != 분석 소유자면 이전 계정 결과를 막는다(매 판정).
// null===null 통과 금지(userId·analysisOwner가 모두 없으면 차단).
export function canUseAnalysisSnapshot(s: ResultGateInput): boolean {
  return (
    !!s.requestedDocId &&
    !!s.userId &&
    s.analysisDocId === s.requestedDocId &&
    s.userId === s.analysisOwner &&
    s.pageCount > 0
  );
}

// 이미지 오버레이(#76) — 업로드 시점 이미지 스냅샷을 결과에 올릴지. **업로드 소유자** 기준.
// 가시성(canUseAnalysisSnapshot)을 통과한 뒤에만 검사한다(호출부 순서 고정).
// 실패하면 이미지 없이 조항 목록-only로 우아하게 저하.
export function canUseUploadImages(s: ResultGateInput): boolean {
  return (
    !!s.requestedDocId &&
    !!s.userId &&
    s.uploadDocId === s.requestedDocId &&
    s.userId === s.uploadOwner
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
