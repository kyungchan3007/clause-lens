import { useMemo } from "react";
import type { PageAnalysisResult } from "@clause-lens/contracts";

import { useAnalysisStore } from "../../../features/analysis";
import { useAuthStore } from "../../../features/auth";
import type { ResultImage } from "../../../features/result";
import { useUploadStore } from "../../../features/upload";
import { isLiveResult, toImageByPageId } from "../lib/resultSource";

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
  const pages = useAnalysisStore((s) => s.pages);
  const uploadDocId = useUploadStore((s) => s.documentId);
  const uploadOwner = useUploadStore((s) => s.ownerUserId);
  const uploadPages = useUploadStore((s) => s.pages);

  const imageByPageId = useMemo(() => toImageByPageId(uploadPages), [uploadPages]);

  if (!requestedDocId) return { kind: "none" };

  const live = isLiveResult({
    requestedDocId,
    userId,
    analysisDocId,
    uploadDocId,
    uploadOwner,
    pageCount: pages.length,
  });

  return live
    ? { kind: "live", documentId: requestedDocId, pages, imageByPageId }
    : { kind: "review", documentId: requestedDocId };
}
