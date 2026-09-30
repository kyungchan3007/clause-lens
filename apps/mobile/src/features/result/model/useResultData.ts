import { useMemo, useState } from "react";
import type { PageAnalysisResult } from "@clause-lens/contracts";

// 결과 화면 로컬 상태: 현재 페이지 + 선택 조항. 선택 키는 조항 id(페이지+버전 범위 안에서 유일).
// 페이지를 바꾸면 선택은 해제한다. (스토어 접근은 app 레이어가 주입 — 여기선 표시 상태만)
export function useResultData(pages: PageAnalysisResult[]) {
  const orderedPages = useMemo(
    () => [...pages].sort((a, b) => a.order - b.order),
    [pages],
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);

  const safeIndex = Math.min(pageIndex, Math.max(0, orderedPages.length - 1));
  const current = orderedPages[safeIndex];

  const goToPage = (index: number) => {
    setPageIndex(index);
    setSelectedClauseId(null); // 페이지 전환 시 선택 해제
  };

  const toggleClause = (id: string) =>
    setSelectedClauseId((prev) => (prev === id ? null : id));

  return {
    orderedPages,
    pageIndex: safeIndex,
    current,
    selectedClauseId,
    goToPage,
    toggleClause,
  };
}
