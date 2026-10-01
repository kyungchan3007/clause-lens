import { create } from "zustand";
import type { DraftImageInput, DraftPage } from "./types";

let seq = 0;
const nextId = () => `draft_${Date.now()}_${seq++}`;

// order 를 배열 인덱스와 항상 일치시킨다(0..n-1). 삭제·재정렬 후 재계산.
const reindex = (pages: DraftPage[]): DraftPage[] =>
  pages.map((p, i) => (p.order === i ? p : { ...p, order: i }));

interface DraftState {
  pages: DraftPage[];
  // 업로드 진행 중엔 편집을 잠근다(스냅샷 불변성 — 교체된 이미지가 잘못 매핑되는 것 방지).
  locked: boolean;
  // 그리드 드래그 세션 중 편집 차단(늦은 드롭이 삭제/교체를 되돌리는 것 방지).
  dragging: boolean;
  addPage: (input: DraftImageInput) => void;
  removePage: (id: string) => void;
  replacePage: (id: string, input: DraftImageInput) => void;
  /** 그리드 드롭: id 순서만 받아 현재 pages를 재배열. id 집합이 정확히 일치할 때만 적용(stale 드롭 방어). */
  reorderByIds: (ids: string[]) => void;
  setLocked: (locked: boolean) => void;
  setDragging: (dragging: boolean) => void;
  clear: () => void;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  pages: [],
  locked: false,
  dragging: false,
  addPage: (input) => {
    if (get().locked || get().dragging) return;
    set((s) => ({
      pages: reindex([...s.pages, { id: nextId(), order: s.pages.length, ...input }]),
    }));
  },
  removePage: (id) => {
    if (get().locked || get().dragging) return;
    set((s) => ({ pages: reindex(s.pages.filter((p) => p.id !== id)) }));
  },
  // 교체: 이미지·메타만 변경, id·order 유지
  replacePage: (id, input) => {
    if (get().locked || get().dragging) return;
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? { ...p, ...input } : p)),
    }));
  },
  // 드롭 결과는 id 순서만 신뢰. 현재 pages의 id 집합과 정확히 일치할 때만 재배열(중복·누락·추가 거부).
  // 집합 불일치 = 드래그 중 삭제/추가로 상태가 바뀐 stale 드롭 → no-op(최신 상태 보존).
  reorderByIds: (ids) => {
    if (get().locked) return;
    const cur = get().pages;
    if (ids.length !== cur.length) return;
    const byId = new Map(cur.map((p) => [p.id, p]));
    if (ids.some((id) => !byId.has(id))) return; // 알 수 없는 id
    const seen = new Set<string>();
    const next: DraftPage[] = [];
    for (const id of ids) {
      if (seen.has(id)) return; // 중복 id
      seen.add(id);
      next.push(byId.get(id)!);
    }
    set({ pages: reindex(next) });
  },
  setLocked: (locked) => set({ locked }),
  setDragging: (dragging) => set({ dragging }),
  clear: () => set({ pages: [], locked: false, dragging: false }),
}));
