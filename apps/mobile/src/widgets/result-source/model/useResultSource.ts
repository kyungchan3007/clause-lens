import { useMemo } from "react";
import type { PageAnalysisResult } from "@clause-lens/contracts";

import { useAnalysisStore } from "../../../features/analysis";
import { useAuthStore } from "../../../features/auth";
import type { ResultImage } from "../../../features/result";
import { useUploadStore } from "../../../features/upload";
import { canUseAnalysisSnapshot, canUseUploadImages, toImageByPageId } from "../lib/resultSource";

export type ResultSource =
  // 방금 분석한 문서 — 메모리 스냅샷(이미지 포함) 결과(격리 경로).
  | {
      kind: "live";
      documentId: string;
      pages: PageAnalysisResult[];
      imageByPageId: Record<string, ResultImage | undefined>;
    }
  // 그 외(최근 목록에서 재열람) — 서버에서 조항을 다시 받아 표시.
  | { kind: "review"; documentId: string }
  | { kind: "none" };

// 결과 화면 경로 판정 — auth·analysis·upload 교차 조합(FSD: 상위 레이어에서 조합).
export function useResultSource(requestedDocId: string | undefined): ResultSource {
  const userId = useAuthStore((s) => s.user?.id);
  const analysisDocId = useAnalysisStore((s) => s.documentId);
  const analysisOwner = useAnalysisStore((s) => s.ownerUserId);
  const pages = useAnalysisStore((s) => s.pages);
  const uploadDocId = useUploadStore((s) => s.documentId);
  const uploadOwner = useUploadStore((s) => s.ownerUserId);
  const uploadPages = useUploadStore((s) => s.pages);

  const allUploadImages = useMemo(() => toImageByPageId(uploadPages), [uploadPages]);

  if (!requestedDocId) return { kind: "none" };

  const gate = {
    requestedDocId,
    userId,
    analysisDocId,
    analysisOwner,
    uploadDocId,
    uploadOwner,
    pageCount: pages.length,
  };

  // 가시성(분석 소유) 실패 → review(서버 재조회). 교차 사용자 결과 노출 차단(#76).
  if (!canUseAnalysisSnapshot(gate)) {
    return { kind: "review", documentId: requestedDocId };
  }

  // 가시성 통과. 이미지는 업로드 스냅샷 소유·문서 일치일 때만 — 아니면 {} → 목록-only 저하.
  const imageByPageId = canUseUploadImages(gate) ? allUploadImages : {};
  return { kind: "live", documentId: requestedDocId, pages, imageByPageId };
}
