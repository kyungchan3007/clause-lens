import { create } from "zustand";
import type { DocumentListItem } from "@clause-lens/contracts";

import { getAccessToken } from "../../auth";
import { fetchRecentDocuments } from "../api/documentsApi";

// 재열람 가능한 최근 분석 문서 목록(0030). "서버가 진실의 기준" — 집계·보관 기한을 표시만.
// entitlement store를 복제하지 않음(목록 특성: 페이지네이션·append·중복 제거·완료 후 갱신).
//  - 계정 격리: 요청 시작 시 generation 캡처 → 응답 반영 전 비교(계정 바뀌면 폐기).
//  - refresh(첫 페이지 재조회) / loadMore(다음 페이지 append) / removeDocument(410 시 제거).

type Status = "idle" | "loading" | "ready" | "error";

interface DocumentsState {
  status: Status;
  items: DocumentListItem[];
  nextCursor: string | null;
  loadingMore: boolean;
  // 내부
  generation: number;
  userId: string | null;
  refreshing: boolean;
  // 액션
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  removeDocument: (documentId: string) => void;
  syncAccount: (userId: string | null) => void;
}

function dedupe(items: DocumentListItem[]): DocumentListItem[] {
  const seen = new Set<string>();
  const out: DocumentListItem[] = [];
  for (const it of items) {
    if (seen.has(it.documentId)) continue;
    seen.add(it.documentId);
    out.push(it);
  }
  return out;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  status: "idle",
  items: [],
  nextCursor: null,
  loadingMore: false,
  generation: 0,
  userId: null,
  refreshing: false,

  // 로그인·복원·계정 변경·로그아웃에서 호출. 같은 userId면 유지, 바뀌면 세대++·초기화.
  syncAccount(userId) {
    if (get().userId === userId) return;
    set({
      generation: get().generation + 1,
      userId,
      status: "idle",
      items: [],
      nextCursor: null,
      loadingMore: false,
      refreshing: false,
    });
  },

  // 첫 페이지 재조회(홈 포커스·분석 완료 등). 기존 목록은 유지하다 교체(깜빡임 방지).
  async refresh() {
    if (get().refreshing) return;
    const gen = get().generation;
    const token = await getAccessToken();
    if (get().generation !== gen) return;
    if (!token) {
      set({ status: "idle", items: [], nextCursor: null });
      return;
    }
    set({ refreshing: true, status: get().items.length ? get().status : "loading" });
    try {
      const page = await fetchRecentDocuments(token);
      if (get().generation !== gen) return; // 계정 변경 → 폐기
      set({ status: "ready", items: dedupe(page.items), nextCursor: page.nextCursor });
    } catch {
      if (get().generation !== gen) return;
      if (!get().items.length) set({ status: "error" });
      // 기존 목록이 있으면 조용히 유지(다음 기회에 갱신).
    } finally {
      if (get().generation === gen) set({ refreshing: false });
    }
  },

  // 다음 페이지 append(무한 스크롤). nextCursor 없으면 no-op.
  async loadMore() {
    const cursor = get().nextCursor;
    if (!cursor || get().loadingMore || get().refreshing) return;
    const gen = get().generation;
    const token = await getAccessToken();
    if (get().generation !== gen || !token) return;
    set({ loadingMore: true });
    try {
      const page = await fetchRecentDocuments(token, cursor);
      if (get().generation !== gen) return;
      set({
        items: dedupe([...get().items, ...page.items]),
        nextCursor: page.nextCursor,
      });
    } catch {
      // 실패는 조용히(사용자가 다시 스크롤하면 재시도). 커서 유지.
    } finally {
      if (get().generation === gen) set({ loadingMore: false });
    }
  },

  // 보관 만료(410) 등으로 접근 불가 확인된 문서를 목록에서 제거.
  removeDocument(documentId) {
    set({ items: get().items.filter((it) => it.documentId !== documentId) });
  },
}));
