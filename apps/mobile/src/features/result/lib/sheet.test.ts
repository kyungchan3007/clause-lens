import {
  computeCollapsedOccupy,
  handleBackPress,
  SHEET_COLLAPSED,
  SHEET_FULL,
  shouldCollapseOnClauseTap,
} from "./sheet";

describe("result/sheet", () => {
  describe("shouldCollapseOnClauseTap", () => {
    it("full + 오버레이 가능 → 접는다", () => {
      expect(shouldCollapseOnClauseTap({ snapIndex: SHEET_FULL, overlayEnabled: true })).toBe(true);
    });
    it("full이어도 오버레이 불가 → 접지 않는다", () => {
      expect(shouldCollapseOnClauseTap({ snapIndex: SHEET_FULL, overlayEnabled: false })).toBe(
        false,
      );
    });
    it("collapsed → 접지 않는다", () => {
      expect(shouldCollapseOnClauseTap({ snapIndex: SHEET_COLLAPSED, overlayEnabled: true })).toBe(
        false,
      );
    });
  });

  describe("computeCollapsedOccupy", () => {
    it("측정 전(0)이면 기본값", () => {
      expect(computeCollapsedOccupy({ contentHeight: 0, imageCardHeight: 300 })).toBe(0.55);
    });
    it("이미지 카드가 클수록 시트는 작게(아래로)", () => {
      const big = computeCollapsedOccupy({ contentHeight: 800, imageCardHeight: 400 });
      const small = computeCollapsedOccupy({ contentHeight: 800, imageCardHeight: 200 });
      expect(big).toBeLessThan(small);
    });
    it("범위 [0.32, 0.72]로 클램프", () => {
      expect(computeCollapsedOccupy({ contentHeight: 800, imageCardHeight: 780 })).toBe(0.32);
      expect(computeCollapsedOccupy({ contentHeight: 800, imageCardHeight: 10 })).toBe(0.72);
    });
  });

  describe("handleBackPress", () => {
    it("full이면 collapse 호출 + 소비(true)", () => {
      const collapse = jest.fn();
      const consumed = handleBackPress({ showSheet: true, snapIndex: SHEET_FULL, collapse });
      expect(collapse).toHaveBeenCalledTimes(1);
      expect(consumed).toBe(true);
    });
    it("collapsed면 미소비(false)", () => {
      const collapse = jest.fn();
      expect(handleBackPress({ showSheet: true, snapIndex: SHEET_COLLAPSED, collapse })).toBe(false);
      expect(collapse).not.toHaveBeenCalled();
    });
    it("시트 없으면 미소비(false)", () => {
      const collapse = jest.fn();
      expect(handleBackPress({ showSheet: false, snapIndex: SHEET_FULL, collapse })).toBe(false);
    });
  });
});
