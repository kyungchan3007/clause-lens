import { FAQ_ITEMS } from "./faq";

describe("FAQ_ITEMS", () => {
  it("최소 1개 이상, 각 항목은 비어있지 않은 q/a", () => {
    expect(FAQ_ITEMS.length).toBeGreaterThan(0);
    for (const item of FAQ_ITEMS) {
      expect(item.q.trim().length).toBeGreaterThan(0);
      expect(item.a.trim().length).toBeGreaterThan(0);
    }
  });

  it("질문(q) 중복 없음", () => {
    const qs = FAQ_ITEMS.map((i) => i.q);
    expect(new Set(qs).size).toBe(qs.length);
  });
});
