import { clauseTypeLabel, riskIcon, riskLabel, riskTone } from "./risk";

describe("riskTone", () => {
  it("위험도 → tone 매핑", () => {
    expect(riskTone("high")).toBe("danger");
    expect(riskTone("medium")).toBe("warning");
    expect(riskTone("low")).toBe("success");
  });
  it("hex가 아니라 tone을 반환한다", () => {
    expect(riskTone("high")).not.toMatch(/^#/);
  });
});

describe("riskLabel / riskIcon", () => {
  it("라벨", () => {
    expect(riskLabel("high")).toBe("높음");
    expect(riskLabel("medium")).toBe("보통");
    expect(riskLabel("low")).toBe("낮음");
  });
  it("아이콘 이름", () => {
    expect(riskIcon("high")).toBe("TriangleAlert");
    expect(riskIcon("low")).toBe("Info");
  });
});

describe("clauseTypeLabel", () => {
  it("분류 코드 라벨(미분류 포함)", () => {
    expect(clauseTypeLabel.auto_renewal).toBe("자동연장");
    expect(clauseTypeLabel.other).toBe("기타");
  });
});
