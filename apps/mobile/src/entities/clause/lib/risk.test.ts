import { clauseTypeLabel, riskIcon, riskLabel, riskTone } from "./risk";

describe("riskTone", () => {
  it("위험도 → tone 매핑", () => {
    expect(riskTone("high")).toBe("danger");
    expect(riskTone("medium")).toBe("warning");
    expect(riskTone("low")).toBe("neutral");
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

describe("예기치 않은 입력 방어", () => {
  // 서버 계약(zod)으로 걸러지지만, 런타임 미지 값에도 undefined를 노출하지 않는다.
  const unknown = "critical" as unknown as "high";
  it("riskTone unknown → neutral", () => {
    expect(riskTone(unknown)).toBe("neutral");
  });
  it("riskLabel/riskIcon unknown → 안전 기본값(undefined 아님)", () => {
    expect(riskLabel(unknown)).toBe("알 수 없음");
    expect(riskIcon(unknown)).toBe("CircleHelp");
    expect(riskLabel(undefined as unknown as "high")).toBeTruthy();
  });
});

describe("clauseTypeLabel", () => {
  it("분류 코드 라벨(미분류 포함)", () => {
    expect(clauseTypeLabel.auto_renewal).toBe("자동연장");
    expect(clauseTypeLabel.other).toBe("기타");
  });
});
