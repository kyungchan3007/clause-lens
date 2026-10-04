import {
  clampIndex,
  isExpanded,
  occupyToTranslateY,
  resolveSnapIndex,
  toggleIndex,
} from "./drag-sheet.lib";

describe("drag-sheet.lib", () => {
  describe("clampIndex", () => {
    it("범위 안은 반올림해 그대로", () => {
      expect(clampIndex(1, 2)).toBe(1);
      expect(clampIndex(0, 2)).toBe(0);
    });
    it("범위 밖은 양끝으로 클램프", () => {
      expect(clampIndex(-3, 2)).toBe(0);
      expect(clampIndex(9, 2)).toBe(1);
    });
    it("count<=0이면 0", () => {
      expect(clampIndex(5, 0)).toBe(0);
    });
  });

  describe("toggleIndex", () => {
    it("2스냅은 0↔1 토글", () => {
      expect(toggleIndex(0, 2)).toBe(1);
      expect(toggleIndex(1, 2)).toBe(0);
    });
    it("접힘(0)에서 열림 끝으로, 열림 끝에서 접힘으로", () => {
      expect(toggleIndex(0, 3)).toBe(2);
      expect(toggleIndex(2, 3)).toBe(0);
      expect(toggleIndex(1, 3)).toBe(2); // 중간은 열림 끝으로
    });
    it("단일/빈 스냅은 0", () => {
      expect(toggleIndex(0, 1)).toBe(0);
      expect(toggleIndex(0, 0)).toBe(0);
    });
  });

  describe("occupyToTranslateY", () => {
    it("1(완전 열림)=0, 0(완전 접힘)=컨테이너 높이", () => {
      expect(occupyToTranslateY(1, 800)).toBe(0);
      expect(occupyToTranslateY(0, 800)).toBe(800);
    });
    it("0.5=절반 내려감", () => {
      expect(occupyToTranslateY(0.5, 800)).toBe(400);
    });
    it("범위 밖 occupy는 0..1로 클램프", () => {
      expect(occupyToTranslateY(1.5, 800)).toBe(0);
      expect(occupyToTranslateY(-1, 800)).toBe(800);
    });
  });

  describe("resolveSnapIndex", () => {
    // positions: [접힘=400, 열림=0] (index 0=collapsed, 1=full)
    const positions = [400, 0];
    it("속도 0이면 최근접 스냅", () => {
      expect(resolveSnapIndex({ positions, current: 360, velocity: 0 })).toBe(0);
      expect(resolveSnapIndex({ positions, current: 40, velocity: 0 })).toBe(1);
    });
    it("위로(열림) 빠른 속도는 full로 투영", () => {
      // current 300(접힘쪽)이어도 위로 -2000px/s면 full(0)로
      expect(resolveSnapIndex({ positions, current: 300, velocity: -2000 })).toBe(1);
    });
    it("아래로(접힘) 빠른 속도는 collapsed로 투영", () => {
      expect(resolveSnapIndex({ positions, current: 100, velocity: 2000 })).toBe(0);
    });
    it("빈 positions는 0", () => {
      expect(resolveSnapIndex({ positions: [], current: 0, velocity: 0 })).toBe(0);
    });
  });

  describe("isExpanded", () => {
    it("최상단(마지막) 스냅이면 true", () => {
      expect(isExpanded(1, 2)).toBe(true);
      expect(isExpanded(0, 2)).toBe(false);
    });
    it("count<=0이면 false", () => {
      expect(isExpanded(0, 0)).toBe(false);
    });
  });
});
