import { useCallback, useState } from "react";

import { getAccessToken } from "../../auth";
import { classifyHttpError } from "../../../shared/lib/httpError";
import { saveDocument } from "../api/documentsApi";
import { useDocumentsStore } from "./documentsStore";

// 분석 결과 장기 보관 전환(저장하기, #163). 멱등.
// 성공 시 목록을 재조회해 "저장됨" 반영. 거부는 서버 status로 분류(표현은 호출측).
export type SaveOutcome = "saved" | "subscription" | "expired" | "conflict" | "error";

export function useSaveDocument(documentId: string | undefined): {
  save: () => Promise<SaveOutcome>;
  saving: boolean;
} {
  const [saving, setSaving] = useState(false);
  const refresh = useDocumentsStore((s) => s.refresh);

  const save = useCallback(async (): Promise<SaveOutcome> => {
    if (!documentId) return "error";
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) return "error";
      await saveDocument(token, documentId);
      await refresh(); // 목록 반영(저장 상태·재열람 유지)
      return "saved";
    } catch (e) {
      switch (classifyHttpError(e)) {
        case "quota":
          return "subscription"; // 403 = 구독 필요
        case "gone":
          return "expired"; // 410 = 보관 기간 경과
        case "conflict":
          return "conflict"; // 409 = 미완료/경쟁
        default:
          return "error";
      }
    } finally {
      setSaving(false);
    }
  }, [documentId, refresh]);

  return { save, saving };
}
