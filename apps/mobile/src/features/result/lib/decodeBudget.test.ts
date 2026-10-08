import { withinDecodeBudget, MAX_DECODE_PIXELS, MAX_DECODE_SIDE } from "./decodeBudget";

describe("withinDecodeBudget (#176)", () => {
  it("일반 폰 사진(12MP)은 예산 안", () => {
    expect(withinDecodeBudget(3000, 4000)).toBe(true); // 12MP, 최대변 4000
  });

  it("픽셀수 상한 초과는 false", () => {
    expect(withinDecodeBudget(6000, 5000)).toBe(false); // 30MP > 24MP
  });

  it("최대변 상한 초과는 false(픽셀수 작아도)", () => {
    expect(withinDecodeBudget(10000, 100)).toBe(false); // 1MP지만 변 10000 > 8192
  });

  it("경계값: 정확히 상한이면 true", () => {
    expect(withinDecodeBudget(MAX_DECODE_SIDE, Math.floor(MAX_DECODE_PIXELS / MAX_DECODE_SIDE))).toBe(true);
  });

  it("치수 0·음수는 false", () => {
    expect(withinDecodeBudget(0, 1000)).toBe(false);
    expect(withinDecodeBudget(1000, -1)).toBe(false);
  });
});
