import {
  boxToScreenRect,
  clampBoxToImage,
  computeContainFit,
  isSizeConsistent,
} from "./coordinateTransform";

describe("computeContainFit", () => {
  it("뷰가 더 넓으면 가로 레터박스(좌우 여백)", () => {
    // 이미지 100x100, 뷰 200x100 → scale 1, 표시 100x100, 좌우 각 50 여백
    const fit = computeContainFit({ width: 100, height: 100 }, { width: 200, height: 100 });
    expect(fit).toEqual({
      scale: 1,
      offsetX: 50,
      offsetY: 0,
      displayWidth: 100,
      displayHeight: 100,
    });
  });

  it("뷰가 더 높으면 세로 레터박스(위아래 여백)", () => {
    // 이미지 100x100, 뷰 100x200 → scale 1, 위아래 각 50 여백
    const fit = computeContainFit({ width: 100, height: 100 }, { width: 100, height: 200 });
    expect(fit).toMatchObject({ scale: 1, offsetX: 0, offsetY: 50 });
  });

  it("소수 배율로 축소", () => {
    // 이미지 1000x500, 뷰 300x300 → scale = min(0.3, 0.6) = 0.3, 표시 300x150, offsetY 75
    const fit = computeContainFit({ width: 1000, height: 500 }, { width: 300, height: 300 });
    expect(fit?.scale).toBeCloseTo(0.3, 5);
    expect(fit?.displayWidth).toBeCloseTo(300, 5);
    expect(fit?.displayHeight).toBeCloseTo(150, 5);
    expect(fit?.offsetX).toBeCloseTo(0, 5);
    expect(fit?.offsetY).toBeCloseTo(75, 5);
  });

  it("뷰 크기 0이면 null", () => {
    expect(computeContainFit({ width: 100, height: 100 }, { width: 0, height: 100 })).toBeNull();
  });

  it("이미지 크기 0/음수면 null", () => {
    expect(computeContainFit({ width: 0, height: 100 }, { width: 100, height: 100 })).toBeNull();
    expect(computeContainFit({ width: -10, height: 100 }, { width: 100, height: 100 })).toBeNull();
  });
});

describe("clampBoxToImage", () => {
  it("이미지 안에 완전히 들어가면 그대로", () => {
    const box = { x: 10, y: 20, width: 30, height: 40 };
    expect(clampBoxToImage(box, { width: 100, height: 100 })).toEqual(box);
  });

  it("경계를 넘으면 교집합으로 클램프", () => {
    // x 80~120 → 80~100 (width 20), y -10~30 → 0~30 (height 30)
    const box = { x: 80, y: -10, width: 40, height: 40 };
    expect(clampBoxToImage(box, { width: 100, height: 100 })).toEqual({
      x: 80,
      y: 0,
      width: 20,
      height: 30,
    });
  });

  it("완전히 범위 밖이면 null", () => {
    expect(clampBoxToImage({ x: 200, y: 200, width: 10, height: 10 }, { width: 100, height: 100 })).toBeNull();
  });

  it("경계에만 붙어 면적 0이면 null", () => {
    // x 100~110 → left 100, right 100 → width 0
    expect(clampBoxToImage({ x: 100, y: 10, width: 10, height: 10 }, { width: 100, height: 100 })).toBeNull();
  });
});

describe("boxToScreenRect", () => {
  it("레터박스 오프셋 + 배율을 적용", () => {
    // 이미지 1000x500, 뷰 300x300 → scale 0.3, offsetY 75
    // 박스 (100,100,200,100) → x 100*0.3+0=30, y 100*0.3+75=105, w 60, h 30
    const rect = boxToScreenRect(
      { x: 100, y: 100, width: 200, height: 100 },
      { width: 1000, height: 500 },
      { width: 300, height: 300 },
    );
    expect(rect?.x).toBeCloseTo(30, 5);
    expect(rect?.y).toBeCloseTo(105, 5);
    expect(rect?.width).toBeCloseTo(60, 5);
    expect(rect?.height).toBeCloseTo(30, 5);
  });

  it("범위를 넘는 박스는 클램프 후 변환", () => {
    // 이미지 100x100, 뷰 100x100(scale 1). 박스 x 90~140 → 90~100(width 10)
    const rect = boxToScreenRect(
      { x: 90, y: 10, width: 50, height: 20 },
      { width: 100, height: 100 },
      { width: 100, height: 100 },
    );
    expect(rect).toEqual({ x: 90, y: 10, width: 10, height: 20 });
  });

  it("완전히 범위 밖이면 null(그리지 않음)", () => {
    expect(
      boxToScreenRect(
        { x: 500, y: 500, width: 10, height: 10 },
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ),
    ).toBeNull();
  });

  it("뷰가 0이면 null", () => {
    expect(
      boxToScreenRect(
        { x: 10, y: 10, width: 10, height: 10 },
        { width: 100, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toBeNull();
  });
});

describe("isSizeConsistent", () => {
  it("정확히 같으면 true", () => {
    expect(isSizeConsistent({ width: 1200, height: 1600 }, { width: 1200, height: 1600 })).toBe(true);
  });

  it("허용 오차 이내면 true", () => {
    expect(isSizeConsistent({ width: 1200, height: 1600 }, { width: 1201, height: 1599 })).toBe(true);
  });

  it("오차를 넘으면 false", () => {
    expect(isSizeConsistent({ width: 1200, height: 1600 }, { width: 1210, height: 1600 })).toBe(false);
  });

  it("방향이 뒤바뀌면(가로세로 교환) false", () => {
    expect(isSizeConsistent({ width: 1200, height: 1600 }, { width: 1600, height: 1200 })).toBe(false);
  });

  it("크기 0/음수면 false", () => {
    expect(isSizeConsistent({ width: 0, height: 100 }, { width: 0, height: 100 })).toBe(false);
  });
});
