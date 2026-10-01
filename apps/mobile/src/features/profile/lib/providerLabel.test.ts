import { providerLabelOf } from "./providerLabel";

describe("providerLabelOf", () => {
  it("등록된 provider는 한글 라벨", () => {
    expect(providerLabelOf("KAKAO")).toBe("카카오");
  });

  it("미등록 provider는 원문 그대로", () => {
    expect(providerLabelOf("APPLE")).toBe("APPLE");
  });

  it("provider가 없으면 빈 문자열(라벨 줄 숨김)", () => {
    expect(providerLabelOf(undefined)).toBe("");
  });
});
