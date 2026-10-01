import { useDraftStore } from "../../../features/capture";
import { useDocumentsStore } from "../../../features/documents";

// 온보딩은 "담은 페이지 없음 & 최근 조회 완료 & 0건"일 때만 — 로딩·실패를 0건으로 오인하지 않는다.
export function useHomeOnboarding(): boolean {
  const hasPages = useDraftStore((s) => s.pages.length > 0);
  const docStatus = useDocumentsStore((s) => s.status);
  const docCount = useDocumentsStore((s) => s.items.length);
  return !hasPages && docStatus === "ready" && docCount === 0;
}
