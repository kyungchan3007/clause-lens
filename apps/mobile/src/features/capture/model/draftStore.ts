import { create } from "zustand";
import type { DraftImageInput, DraftPage } from "./types";

let seq = 0;
const nextId = () => `draft_${Date.now()}_${seq++}`;

// order 를 배열 인덱스와 항상 일치시킨다(0..n-1). 삭제·재정렬 후 재계산.
const reindex = (pages: DraftPage[]): DraftPage[] =>
  pages.map((p, i) => (p.order === i ? p : { ...p, order: i }));

interface DraftState {
  pages: DraftPage[];
  addPage: (input: DraftImageInput) => void;
  removePage: (id: string) => void;
  replacePage: (id: string, input: DraftImageInput) => void;
  /** draggable list 의 onDragEnd 등에서 새 순서 배열을 통째로 반영 */
  setPages: (pages: DraftPage[]) => void;
  clear: () => void;
}

export const useDraftStore = create<DraftState>((set) => ({
  pages: [],
  addPage: (input) =>
    set((s) => ({
      pages: reindex([...s.pages, { id: nextId(), order: s.pages.length, ...input }]),
    })),
  removePage: (id) =>
    set((s) => ({ pages: reindex(s.pages.filter((p) => p.id !== id)) })),
  // 교체: localUri·width·height 만 변경, id·order 유지
  replacePage: (id, input) =>
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? { ...p, ...input } : p)),
    })),
  setPages: (pages) => set({ pages: reindex(pages) }),
  clear: () => set({ pages: [] }),
}));
