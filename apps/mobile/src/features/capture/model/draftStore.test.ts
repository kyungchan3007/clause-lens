import { useDraftStore } from "./draftStore";
import type { DraftImageInput } from "./types";

const img = (n: string): DraftImageInput => ({
  localUri: `file://${n}.jpg`,
  thumbUri: `file://${n}.thumb.jpg`,
  width: 1200,
  height: 1600,
  contentType: "image/jpeg",
  sizeBytes: 1000,
});

const reset = () => useDraftStore.setState({ pages: [], locked: false, dragging: false });
const ids = () => useDraftStore.getState().pages.map((p) => p.id);
const orders = () => useDraftStore.getState().pages.map((p) => p.order);

describe("draftStore", () => {
  beforeEach(reset);

  it("addPage: thumbUri 보존 + order 0..n-1", () => {
    const s = useDraftStore.getState();
    s.addPage(img("a"));
    s.addPage(img("b"));
    const pages = useDraftStore.getState().pages;
    expect(pages.map((p) => p.thumbUri)).toEqual(["file://a.thumb.jpg", "file://b.thumb.jpg"]);
    expect(orders()).toEqual([0, 1]);
  });

  describe("reorderByIds — id 집합 검증(stale 드롭 방어)", () => {
    beforeEach(() => {
      const s = useDraftStore.getState();
      s.addPage(img("a"));
      s.addPage(img("b"));
      s.addPage(img("c"));
    });

    it("정확히 일치하면 그 순서로 재배열 + reindex", () => {
      const [a, b, c] = ids();
      useDraftStore.getState().reorderByIds([c, a, b]);
      expect(ids()).toEqual([c, a, b]);
      expect(orders()).toEqual([0, 1, 2]);
    });

    it("길이 다르면(드래그 중 삭제) no-op", () => {
      const [a, b] = ids();
      const before = ids();
      useDraftStore.getState().reorderByIds([a, b]); // c 빠짐
      expect(ids()).toEqual(before);
    });

    it("알 수 없는 id 포함 시 no-op", () => {
      const [a, b] = ids();
      const before = ids();
      useDraftStore.getState().reorderByIds([a, b, "ghost"]);
      expect(ids()).toEqual(before);
    });

    it("중복 id 포함 시 no-op", () => {
      const [a, b] = ids();
      const before = ids();
      useDraftStore.getState().reorderByIds([a, a, b]);
      expect(ids()).toEqual(before);
    });

    it("locked면 재배열 거부", () => {
      const [a, b, c] = ids();
      useDraftStore.setState({ locked: true });
      useDraftStore.getState().reorderByIds([c, b, a]);
      expect(ids()).toEqual([a, b, c]);
    });
  });

  describe("dragging 가드 — 드래그 중 편집 차단", () => {
    it("dragging이면 add/remove/replace 거부", () => {
      const s = useDraftStore.getState();
      s.addPage(img("a"));
      const [a] = ids();
      useDraftStore.setState({ dragging: true });
      s.addPage(img("b"));
      s.removePage(a);
      s.replacePage(a, img("z"));
      expect(ids()).toEqual([a]);
      expect(useDraftStore.getState().pages[0].thumbUri).toBe("file://a.thumb.jpg");
    });
  });

  it("clear: pages 비우고 locked·dragging 리셋", () => {
    const s = useDraftStore.getState();
    s.addPage(img("a"));
    useDraftStore.setState({ locked: true, dragging: true });
    useDraftStore.getState().clear();
    expect(useDraftStore.getState().pages).toEqual([]);
    expect(useDraftStore.getState().locked).toBe(false);
    expect(useDraftStore.getState().dragging).toBe(false);
  });
});
