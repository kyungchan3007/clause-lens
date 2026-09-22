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
  addPage: (input: DraftImageInput) => void;
  removePage: (id: string) => void;
  replacePage: (id: string, input: DraftImageInput) => void;
  /** draggable list 의 onDragEnd 등에서 새 순서 배열을 통째로 반영 */
  setPages: (pages: DraftPage[]) => void;
  setLocked: (locked: boolean) => void;
  clear: () => void;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  pages: [],
  locked: false,
  addPage: (input) => {
    if (get().locked) return;
    set((s) => ({
      pages: reindex([...s.pages, { id: nextId(), order: s.pages.length, ...input }]),
    }));
  },
  removePage: (id) => {
    if (get().locked) return;
    set((s) => ({ pages: reindex(s.pages.filter((p) => p.id !== id)) }));
  },
  // 교체: 이미지·메타만 변경, id·order 유지
  replacePage: (id, input) => {
    if (get().locked) return;
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? { ...p, ...input } : p)),
    }));
  },
  setPages: (pages) => {
    if (get().locked) return;
    set({ pages: reindex(pages) });
  },
  setLocked: (locked) => set({ locked }),
  clear: () => set({ pages: [], locked: false }),
}));
