import { useCallback, useEffect, useState } from "react";
import type { PageAnalysisResult } from "@clause-lens/contracts";

import { getAccessToken } from "../../auth";
import { HttpError } from "../../../shared/http";
import { fetchDocumentReview } from "../api/documentsApi";
import { useDocumentsStore } from "./documentsStore";

// 재열람(조항) 데이터 로드. 서버 /documents/:id/analysis 재사용.
// 410(보관 경과) = gone → 목록에서 제거. 계정 격리는 서버 소유권 검사 + 요청별 토큰으로.
type ReviewState = "loading" | "ready" | "gone" | "error";

export function useDocumentReview(documentId: string | undefined): {
  state: ReviewState;
  pages: PageAnalysisResult[];
  reload: () => void;
} {
  const [state, setState] = useState<ReviewState>("loading");
  const [pages, setPages] = useState<PageAnalysisResult[]>([]);
  const removeDocument = useDocumentsStore((s) => s.removeDocument);

  const load = useCallback(async () => {
    if (!documentId) {
      setState("error");
      return;
    }
    setState("loading");
    const token = await getAccessToken();
    if (!token) {
      setState("error");
      return;
    }
    try {
      const res = await fetchDocumentReview(token, documentId);
      // 조항이 있는 완료 페이지만(진행중 상태로 재진입하는 경우 방어).
      setPages(res.pages);
      setState("ready");
    } catch (e) {
      if (e instanceof HttpError && e.status === 410) {
        removeDocument(documentId); // 보관 경과 → 목록에서도 제거
        setState("gone");
        return;
      }
      setState("error");
    }
  }, [documentId, removeDocument]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, pages, reload: () => void load() };
}
